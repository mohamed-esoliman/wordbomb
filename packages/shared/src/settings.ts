import { z } from 'zod';

export const PROMPT_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type PromptDifficulty = (typeof PROMPT_DIFFICULTIES)[number];

export const SETTINGS_BOUNDS = {
  maxPlayers: { min: 2, max: 12 },
  startingLives: { min: 1, max: 5 },
  maxLives: { min: 1, max: 6 },
  minTurnSeconds: { min: 2, max: 15 },
  bombMinSeconds: { min: 5, max: 60 },
  bombMaxSeconds: { min: 5, max: 120 },
  minWordLength: { min: 2, max: 6 },
} as const;

type BoundedKey = keyof typeof SETTINGS_BOUNDS;

const bounded = (key: BoundedKey) =>
  z.number().int().min(SETTINGS_BOUNDS[key].min).max(SETTINGS_BOUNDS[key].max);

export const GameSettingsSchema = z
  .object({
    maxPlayers: bounded('maxPlayers'),
    startingLives: bounded('startingLives'),
    maxLives: bounded('maxLives'),
    minTurnSeconds: bounded('minTurnSeconds'),
    bombMinSeconds: bounded('bombMinSeconds'),
    bombMaxSeconds: bounded('bombMaxSeconds'),
    minWordLength: bounded('minWordLength'),
    promptDifficulty: z.enum(PROMPT_DIFFICULTIES),
    alphabetBonus: z.boolean(),
  })
  .refine((s) => s.maxLives >= s.startingLives, {
    message: 'maxLives must be at least startingLives',
    path: ['maxLives'],
  })
  .refine((s) => s.bombMaxSeconds >= s.bombMinSeconds, {
    message: 'bombMaxSeconds must be at least bombMinSeconds',
    path: ['bombMaxSeconds'],
  });

export type GameSettings = z.infer<typeof GameSettingsSchema>;

export const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 8,
  startingLives: 2,
  maxLives: 3,
  minTurnSeconds: 5,
  bombMinSeconds: 10,
  bombMaxSeconds: 30,
  minWordLength: 3,
  promptDifficulty: 'medium',
  alphabetBonus: true,
};
