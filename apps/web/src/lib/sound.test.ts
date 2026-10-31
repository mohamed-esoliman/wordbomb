import { expect, test } from 'vitest';
import { loadSoundSettings, SOUND_KEY, SoundEngine, tickIntervalMs } from './sound.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

test('tick interval speeds up with intensity and is slow while safe', () => {
  expect(tickIntervalMs(0.9, true)).toBe(1000);
  expect(tickIntervalMs(0, false)).toBe(900);
  expect(tickIntervalMs(1, false)).toBe(120);
  expect(tickIntervalMs(0.5, false)).toBeGreaterThan(tickIntervalMs(0.8, false));
});

test('sound settings load defaults and repair bad values', () => {
  expect(loadSoundSettings(memoryStorage())).toEqual({ volume: 0.6, muted: false });
  const bad = memoryStorage({ [SOUND_KEY]: JSON.stringify({ volume: 7, muted: 'yes' }) });
  expect(loadSoundSettings(bad)).toEqual({ volume: 0.6, muted: false });
  const good = memoryStorage({ [SOUND_KEY]: JSON.stringify({ volume: 0.2, muted: true }) });
  expect(loadSoundSettings(good)).toEqual({ volume: 0.2, muted: true });
});

test('engine persists updates and notifies subscribers without an audio context', () => {
  const storage = memoryStorage();
  const engine = new SoundEngine(storage);
  let notified = 0;
  engine.subscribe(() => notified++);
  engine.update({ muted: true });
  expect(notified).toBe(1);
  expect(JSON.parse(storage.data.get(SOUND_KEY)!)).toEqual({ volume: 0.6, muted: true });
  expect(() => engine.play('explode')).not.toThrow();
  expect(() => engine.unlock()).not.toThrow();
});
