import {
  ALPHABET,
  type GameSettings,
  type GameStatus,
  type PromptDifficulty,
  type RejectReason,
} from '@wordbomb/shared';

export type Rng = () => number;

export interface EngineDeps {
  rng: Rng;
  now: () => number;
  dictionary: { has(word: string): boolean };
  prompts: { pick(difficulty: PromptDifficulty, recent: readonly string[], rng: Rng): string };
}

export interface Seat {
  playerId: string;
  lives: number;
  eliminated: boolean;
  usedLetters: Set<string>;
  currentInput: string;
}

export type GameEvent =
  | { type: 'turn_started'; playerId: string; prompt: string }
  | { type: 'word_accepted'; playerId: string; word: string; newLetters: string[] }
  | { type: 'word_rejected'; playerId: string; word: string; reason: RejectReason }
  | { type: 'bomb_exploded'; playerId: string; livesLeft: number }
  | { type: 'life_gained'; playerId: string; lives: number }
  | { type: 'player_eliminated'; playerId: string }
  | { type: 'game_finished'; winnerId: string | null };

export const RECENT_PROMPTS_LIMIT = 30;
export const MAX_INPUT_LENGTH = 40;

const WORD_PATTERN = /^[a-z]+$/;

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export class Game {
  readonly settings: GameSettings;
  readonly seats: Seat[];
  status: GameStatus = 'playing';
  turnIndex = 0;
  prompt = '';
  turnStartedAt = 0;
  bomb = { litAt: 0, explodeAt: 0 };
  readonly usedWords = new Set<string>();
  readonly words: { playerId: string; word: string }[] = [];
  readonly recentPrompts: string[] = [];
  winnerId: string | null = null;
  private started = false;
  private readonly deps: EngineDeps;

  constructor(settings: GameSettings, playerIds: readonly string[], deps: EngineDeps) {
    if (playerIds.length < 2) throw new Error('a game needs at least 2 players');
    this.settings = settings;
    this.deps = deps;
    this.seats = shuffle(playerIds, deps.rng).map((playerId) => ({
      playerId,
      lives: settings.startingLives,
      eliminated: false,
      usedLetters: new Set<string>(),
      currentInput: '',
    }));
  }

  start(): GameEvent[] {
    if (this.started) throw new Error('game already started');
    this.started = true;
    this.lightBomb();
    return this.startTurn(0);
  }

  get holder(): Seat {
    return this.seats[this.turnIndex]!;
  }

  get holderId(): string {
    return this.holder.playerId;
  }

  get explodeAt(): number {
    return this.bomb.explodeAt;
  }

  alivePlayerIds(): string[] {
    return this.seats.filter((s) => !s.eliminated).map((s) => s.playerId);
  }

  setInput(playerId: string, text: string): boolean {
    if (this.status !== 'playing' || this.holderId !== playerId) return false;
    this.holder.currentInput = text.slice(0, MAX_INPUT_LENGTH);
    return true;
  }

  submitWord(playerId: string, raw: string): GameEvent[] {
    const word = raw.trim().toLowerCase();
    const reason = this.rejectReason(playerId, word);
    if (reason) return [{ type: 'word_rejected', playerId, word, reason }];

    const seat = this.holder;
    this.usedWords.add(word);
    this.words.push({ playerId, word });
    const newLetters = [...new Set(word)].filter((l) => !seat.usedLetters.has(l)).sort();
    for (const letter of newLetters) seat.usedLetters.add(letter);
    seat.currentInput = '';

    const events: GameEvent[] = [{ type: 'word_accepted', playerId, word, newLetters }];
    if (this.settings.alphabetBonus && seat.usedLetters.size === ALPHABET.length) {
      seat.usedLetters.clear();
      if (seat.lives < this.settings.maxLives) {
        seat.lives += 1;
        events.push({ type: 'life_gained', playerId, lives: seat.lives });
      }
    }
    events.push(...this.advanceTurn());
    return events;
  }

  explode(): GameEvent[] {
    if (this.status !== 'playing') return [];
    const seat = this.holder;
    seat.lives -= 1;
    seat.currentInput = '';
    const events: GameEvent[] = [
      { type: 'bomb_exploded', playerId: seat.playerId, livesLeft: seat.lives },
    ];
    if (seat.lives <= 0) {
      seat.eliminated = true;
      events.push({ type: 'player_eliminated', playerId: seat.playerId });
    }
    const finished = this.finishIfDecided();
    if (finished) return [...events, finished];
    this.lightBomb();
    events.push(...this.advanceTurn());
    return events;
  }

  private rejectReason(playerId: string, word: string): RejectReason | null {
    if (this.status !== 'playing') return 'game_over';
    if (this.holderId !== playerId) return 'not_your_turn';
    if (word.length < this.settings.minWordLength) return 'too_short';
    if (!word.includes(this.prompt)) return 'missing_prompt';
    if (!WORD_PATTERN.test(word) || !this.deps.dictionary.has(word)) return 'not_a_word';
    if (this.usedWords.has(word)) return 'already_used';
    return null;
  }

  private lightBomb(): void {
    const { bombMinSeconds, bombMaxSeconds } = this.settings;
    const lifetimeMs =
      (bombMinSeconds + this.deps.rng() * (bombMaxSeconds - bombMinSeconds)) * 1000;
    const now = this.deps.now();
    this.bomb = { litAt: now, explodeAt: now + lifetimeMs };
  }

  private advanceTurn(): GameEvent[] {
    const count = this.seats.length;
    for (let step = 1; step <= count; step++) {
      const index = (this.turnIndex + step) % count;
      if (!this.seats[index]!.eliminated) return this.startTurn(index);
    }
    throw new Error('no alive players to pass the turn to');
  }

  private startTurn(index: number): GameEvent[] {
    this.turnIndex = index;
    this.prompt = this.deps.prompts.pick(
      this.settings.promptDifficulty,
      this.recentPrompts,
      this.deps.rng,
    );
    this.recentPrompts.push(this.prompt);
    if (this.recentPrompts.length > RECENT_PROMPTS_LIMIT) this.recentPrompts.shift();

    const now = this.deps.now();
    this.turnStartedAt = now;
    const earliestExplosion = now + this.settings.minTurnSeconds * 1000;
    if (this.bomb.explodeAt < earliestExplosion) this.bomb.explodeAt = earliestExplosion;
    this.holder.currentInput = '';
    return [{ type: 'turn_started', playerId: this.holderId, prompt: this.prompt }];
  }

  private finishIfDecided(): GameEvent | null {
    const alive = this.seats.filter((s) => !s.eliminated);
    if (alive.length > 1) return null;
    this.status = 'finished';
    this.winnerId = alive[0]?.playerId ?? null;
    return { type: 'game_finished', winnerId: this.winnerId };
  }
}
