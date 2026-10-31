import { expect, test } from 'vitest';
import { AVATAR_IDS } from '@wordbomb/shared';
import { loadProfile, PROFILE_KEY, saveProfile } from './profile.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

test('a fresh profile gets a token and avatar and is persisted', () => {
  const storage = memoryStorage();
  const profile = loadProfile(storage);
  expect(profile.name).toBe('');
  expect(AVATAR_IDS).toContain(profile.avatar);
  expect(profile.token.length).toBeGreaterThanOrEqual(16);
  expect(JSON.parse(storage.data.get(PROFILE_KEY)!)).toEqual(profile);
});

test('a stored profile is loaded and invalid parts are repaired', () => {
  const storage = memoryStorage({
    [PROFILE_KEY]: JSON.stringify({ name: '<bad>', avatar: 'nope', token: 'short' }),
  });
  const profile = loadProfile(storage);
  expect(profile.name).toBe('');
  expect(AVATAR_IDS).toContain(profile.avatar);
  expect(profile.token).not.toBe('short');
});

test('valid stored profiles round-trip untouched', () => {
  const storage = memoryStorage();
  const saved = { name: 'Mo', avatar: AVATAR_IDS[3]!, token: 'a'.repeat(20) };
  saveProfile(storage, saved);
  expect(loadProfile(storage)).toEqual(saved);
});

test('corrupt storage falls back to a fresh profile', () => {
  const storage = memoryStorage({ [PROFILE_KEY]: '{not json' });
  expect(loadProfile(storage).name).toBe('');
});
