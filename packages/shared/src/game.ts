export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

export const REJECT_REASONS = [
  'game_over',
  'not_your_turn',
  'too_short',
  'missing_prompt',
  'not_a_word',
  'already_used',
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export const REJECT_MESSAGES: Record<RejectReason, string> = {
  game_over: 'The game is over',
  not_your_turn: 'It is not your turn',
  too_short: 'Too short',
  missing_prompt: 'Must contain the prompt',
  not_a_word: 'Not in the dictionary',
  already_used: 'Already used this game',
};

export type GameStatus = 'playing' | 'finished';

export interface SeatSnapshot {
  playerId: string;
  lives: number;
  eliminated: boolean;
  usedLetters: string[];
  currentInput: string;
}

export interface PlayedWord {
  playerId: string;
  word: string;
}

export interface GameSnapshot {
  status: GameStatus;
  seats: SeatSnapshot[];
  turnIndex: number;
  prompt: string;
  turnStartedAt: number;
  bombLitAt: number;
  words: PlayedWord[];
  winnerId: string | null;
}
