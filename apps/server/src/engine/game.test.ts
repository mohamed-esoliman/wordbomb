import { describe, expect, test } from 'vitest';
import type { GameSettings } from '@wordbomb/shared';
import { Game, type GameEvent } from './game.ts';
import { createHarness, types } from './test-helpers.ts';

describe('start', () => {
  test('seats every player with starting lives and lights a bomb', () => {
    const { game, clock } = createHarness({ settings: { startingLives: 3 } });
    const events = game.start();
    expect(game.seats.map((s) => s.playerId).sort()).toEqual(['a', 'b', 'c']);
    expect(game.seats.every((s) => s.lives === 3 && !s.eliminated)).toBe(true);
    expect(game.status).toBe('playing');
    expect(types(events)).toEqual(['turn_started']);
    expect(game.turnIndex).toBe(0);
    expect(game.turnStartedAt).toBe(clock.now);
    expect(game.bomb.litAt).toBe(clock.now);
  });

  test('bomb lifetime is drawn from the configured range', () => {
    const { game, clock } = createHarness({
      rng: [0.5],
      settings: { bombMinSeconds: 10, bombMaxSeconds: 30 },
    });
    game.start();
    expect(game.explodeAt).toBe(clock.now + 20_000);
  });

  test('seating order depends on rng', () => {
    const low = createHarness({ rng: [0] }).game.seats.map((s) => s.playerId);
    const high = createHarness({ rng: [0.99] }).game.seats.map((s) => s.playerId);
    expect(low).not.toEqual(high);
  });

  test('requires two players and cannot start twice', () => {
    expect(() => createHarness({ players: ['solo'] })).toThrow(/at least 2/);
    const { game } = createHarness();
    game.start();
    expect(() => game.start()).toThrow(/already started/);
  });
});

describe('submitWord', () => {
  test('rejects submissions from players who do not hold the bomb', () => {
    const { game } = createHarness();
    game.start();
    const other = game.seats[1]!.playerId;
    expect(game.submitWord(other, 'cat')).toEqual([
      { type: 'word_rejected', playerId: other, word: 'cat', reason: 'not_your_turn' },
    ]);
  });

  test('rejects words in validation order', () => {
    const { game } = createHarness({
      players: ['a', 'b'],
      prompts: ['at'],
      settings: { minWordLength: 3 },
    });
    game.start();
    const holder = game.holderId;
    const reasonFor = (word: string) => {
      const [event] = game.submitWord(holder, word);
      return event?.type === 'word_rejected' ? event.reason : event?.type;
    };
    expect(reasonFor('at')).toBe('too_short');
    expect(reasonFor('dog')).toBe('missing_prompt');
    expect(reasonFor('batx')).toBe('not_a_word');
    expect(reasonFor('at4')).toBe('not_a_word');
    expect(reasonFor('cat')).toBe('word_accepted');
    game.submitWord(game.holderId, 'scat');
    expect(game.holderId).toBe(holder);
    expect(reasonFor('CAT')).toBe('already_used');
  });

  test('accepted words advance the turn and record letters', () => {
    const { game, clock } = createHarness({ prompts: ['at', 'og'] });
    game.start();
    const holder = game.holderId;
    clock.now += 2_000;
    const events = game.submitWord(holder, ' Cats ');
    expect(events).toEqual([
      { type: 'word_accepted', playerId: holder, word: 'cats', newLetters: ['a', 'c', 's', 't'] },
      { type: 'turn_started', playerId: game.seats[1]!.playerId, prompt: 'og' },
    ]);
    expect(game.turnIndex).toBe(1);
    expect(game.turnStartedAt).toBe(clock.now);
    expect(game.words).toEqual([{ playerId: holder, word: 'cats' }]);
    expect([...game.seats[0]!.usedLetters].sort()).toEqual(['a', 'c', 's', 't']);
  });

  test('only reports letters that are new for that player', () => {
    const { game } = createHarness({ players: ['a', 'b'] });
    game.start();
    const first = game.holderId;
    game.submitWord(first, 'cat');
    game.submitWord(game.holderId, 'dog');
    const [accepted] = game.submitWord(first, 'scat');
    expect(accepted).toMatchObject({ type: 'word_accepted', newLetters: ['s'] });
  });

  test('the bomb keeps burning across turns but each holder gets the minimum turn', () => {
    const { game, clock } = createHarness({
      rng: [0.5, 0],
      settings: { bombMinSeconds: 10, bombMaxSeconds: 30, minTurnSeconds: 5 },
    });
    game.start();
    const explodeAt = game.explodeAt;
    clock.now += 1_000;
    game.submitWord(game.holderId, 'cat');
    expect(game.explodeAt).toBe(explodeAt);
    clock.now = explodeAt - 1_000;
    game.submitWord(game.holderId, 'dog');
    expect(game.explodeAt).toBe(clock.now + 5_000);
  });
});

describe('explode', () => {
  test('costs the holder a life, lights a new bomb and passes the turn', () => {
    const { game, clock } = createHarness({ rng: [0.5], settings: { startingLives: 2 } });
    game.start();
    const holder = game.holderId;
    clock.now += 15_000;
    const events = game.explode();
    expect(types(events)).toEqual(['bomb_exploded', 'turn_started']);
    expect(events[0]).toEqual({ type: 'bomb_exploded', playerId: holder, livesLeft: 1 });
    expect(game.holderId).toBe(game.seats[1]!.playerId);
    expect(game.bomb.litAt).toBe(clock.now);
    expect(game.explodeAt).toBe(clock.now + 20_000);
  });

  test('eliminates at zero lives and skips eliminated seats', () => {
    const { game } = createHarness({ settings: { startingLives: 1 } });
    game.start();
    const [first, second, third] = game.seats.map((s) => s.playerId) as [string, string, string];
    const events = game.explode();
    expect(types(events)).toEqual(['bomb_exploded', 'player_eliminated', 'turn_started']);
    expect(game.seats[0]!.eliminated).toBe(true);
    expect(game.holderId).toBe(second);
    game.submitWord(second, 'cat');
    expect(game.holderId).toBe(third);
    game.submitWord(third, 'dog');
    expect(game.holderId).toBe(second);
    expect(game.alivePlayerIds()).toEqual([second, third]);
    expect(first).not.toBe(second);
  });

  test('finishes the game when one player remains', () => {
    const { game } = createHarness({ players: ['a', 'b'], settings: { startingLives: 1 } });
    game.start();
    const loser = game.holderId;
    const winner = game.seats[1]!.playerId;
    const events = game.explode();
    expect(types(events)).toEqual(['bomb_exploded', 'player_eliminated', 'game_finished']);
    expect(events.at(-1)).toEqual({ type: 'game_finished', winnerId: winner });
    expect(game.status).toBe('finished');
    expect(game.winnerId).toBe(winner);
    expect(game.explode()).toEqual([]);
    expect(game.submitWord(winner, 'cat')).toEqual([
      { type: 'word_rejected', playerId: winner, word: 'cat', reason: 'game_over' },
    ]);
    expect(game.submitWord(loser, 'cat')[0]).toMatchObject({ reason: 'game_over' });
  });
});

describe('typing preview', () => {
  test('only the holder can set input and it is cleared on turn change', () => {
    const { game } = createHarness();
    game.start();
    const holder = game.holderId;
    const other = game.seats[1]!.playerId;
    expect(game.setInput(other, 'xx')).toBe(false);
    expect(game.setInput(holder, 'ca')).toBe(true);
    expect(game.holder.currentInput).toBe('ca');
    game.setInput(holder, 'x'.repeat(100));
    expect(game.holder.currentInput).toHaveLength(40);
    game.submitWord(holder, 'cat');
    expect(game.seats[0]!.currentInput).toBe('');
  });
});

describe('prompts', () => {
  test('passes recent prompts to the picker, capped at 30', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const prompts = Array.from(
      { length: 40 },
      (_, i) => letters[Math.floor(i / 26)]! + letters[i % 26]!,
    );
    const harness = createHarness({
      players: ['a', 'b'],
      prompts,
      words: prompts,
      settings: { minWordLength: 2 },
    });
    const { game } = harness;
    game.start();
    for (let i = 0; i < 35; i++) game.submitWord(game.holderId, game.prompt);
    expect(harness.pickedRecents[0]).toEqual([]);
    expect(harness.pickedRecents[5]).toEqual(['aa', 'ab', 'ac', 'ad', 'ae']);
    expect(harness.pickedRecents.at(-1)).toHaveLength(30);
    expect(game.recentPrompts).toHaveLength(30);
  });
});

test('Game is constructible with real-looking settings', () => {
  const { deps } = createHarness();
  const game = new Game(
    {
      maxPlayers: 4,
      startingLives: 2,
      maxLives: 3,
      minTurnSeconds: 5,
      bombMinSeconds: 10,
      bombMaxSeconds: 30,
      minWordLength: 3,
      promptDifficulty: 'medium',
      alphabetBonus: true,
    },
    ['x', 'y'],
    deps,
  );
  expect(game.seats).toHaveLength(2);
});

describe('alphabet bonus', () => {
  const pangram = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog'];
  const filler = pangram.map((_, i) => 'z'.repeat(3 + i));

  function playPangram(settings: Partial<GameSettings>) {
    const { game } = createHarness({
      players: ['a', 'b'],
      words: [...pangram, ...filler],
      settings,
    });
    game.start();
    const collector = game.holderId;
    const events: GameEvent[] = [];
    pangram.forEach((word, i) => {
      events.push(...game.submitWord(collector, word));
      game.submitWord(game.holderId, filler[i]!);
    });
    return { game, collector, events };
  }

  test('completing the alphabet grants a life and resets the tracker', () => {
    const { game, collector, events } = playPangram({ startingLives: 2, maxLives: 3 });
    const seat = game.seats.find((s) => s.playerId === collector)!;
    expect(events.filter((e) => e.type === 'life_gained')).toEqual([
      { type: 'life_gained', playerId: collector, lives: 3 },
    ]);
    expect(seat.lives).toBe(3);
    expect(seat.usedLetters.size).toBe(0);
  });

  test('at max lives the tracker resets without a life', () => {
    const { game, collector, events } = playPangram({ startingLives: 3, maxLives: 3 });
    const seat = game.seats.find((s) => s.playerId === collector)!;
    expect(events.some((e) => e.type === 'life_gained')).toBe(false);
    expect(seat.lives).toBe(3);
    expect(seat.usedLetters.size).toBe(0);
  });

  test('does nothing when disabled', () => {
    const { game, collector, events } = playPangram({ alphabetBonus: false });
    const seat = game.seats.find((s) => s.playerId === collector)!;
    expect(events.some((e) => e.type === 'life_gained')).toBe(false);
    expect(seat.usedLetters.size).toBe(26);
  });
});
