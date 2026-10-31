import { expect, test } from 'vitest';
import { DEFAULT_SETTINGS, GameSettingsSchema } from './settings.ts';

test('default settings are valid', () => {
  expect(GameSettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
});

test('rejects maxLives below startingLives', () => {
  const result = GameSettingsSchema.safeParse({
    ...DEFAULT_SETTINGS,
    startingLives: 3,
    maxLives: 2,
  });
  expect(result.success).toBe(false);
});

test('rejects bomb max below bomb min', () => {
  const result = GameSettingsSchema.safeParse({
    ...DEFAULT_SETTINGS,
    bombMinSeconds: 20,
    bombMaxSeconds: 10,
  });
  expect(result.success).toBe(false);
});

test('rejects out of range and non-integer values', () => {
  expect(GameSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, maxPlayers: 13 }).success).toBe(false);
  expect(GameSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, minTurnSeconds: 2.5 }).success).toBe(
    false,
  );
  expect(
    GameSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, promptDifficulty: 'brutal' }).success,
  ).toBe(false);
});
