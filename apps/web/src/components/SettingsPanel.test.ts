import { expect, test } from 'vitest';
import { DEFAULT_SETTINGS } from '@wordbomb/shared';
import { normalizeSettings } from './SettingsPanel';

test('raising starting lives above max lives raises max lives', () => {
  const next = normalizeSettings({ ...DEFAULT_SETTINGS, startingLives: 5 }, 'startingLives');
  expect(next.maxLives).toBe(5);
});

test('lowering max lives below starting lives lowers starting lives', () => {
  const next = normalizeSettings({ ...DEFAULT_SETTINGS, maxLives: 1 }, 'maxLives');
  expect(next.startingLives).toBe(1);
});

test('bomb range stays ordered whichever end moved', () => {
  expect(
    normalizeSettings({ ...DEFAULT_SETTINGS, bombMinSeconds: 45 }, 'bombMinSeconds').bombMaxSeconds,
  ).toBe(45);
  expect(
    normalizeSettings({ ...DEFAULT_SETTINGS, bombMaxSeconds: 6 }, 'bombMaxSeconds').bombMinSeconds,
  ).toBe(6);
  expect(normalizeSettings(DEFAULT_SETTINGS, 'maxPlayers')).toEqual(DEFAULT_SETTINGS);
});
