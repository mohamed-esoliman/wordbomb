import { expect, test } from 'vitest';
import { fuseState, ServerClock } from './clock.ts';

const base = { bombLitAt: 1000, turnStartedAt: 1000, minTurnSeconds: 5, bombMaxSeconds: 30 };

test('fuse is safe during the minimum turn and intensity ramps with bomb age', () => {
  expect(fuseState({ ...base, now: 1000 })).toEqual({
    bombElapsedMs: 0,
    turnElapsedMs: 0,
    safe: true,
    intensity: 0,
  });
  expect(fuseState({ ...base, now: 16000 })).toMatchObject({ safe: false, intensity: 0.5 });
  expect(fuseState({ ...base, now: 1000 + 60_000 }).intensity).toBe(1);
});

test('a new holder resets the safe window but not the bomb age', () => {
  const state = fuseState({ ...base, now: 21000, turnStartedAt: 20000 });
  expect(state.safe).toBe(true);
  expect(state.turnElapsedMs).toBe(1000);
  expect(state.bombElapsedMs).toBe(20000);
});

test('clock skew is handled without negative values', () => {
  expect(fuseState({ ...base, now: 500 })).toMatchObject({ bombElapsedMs: 0, turnElapsedMs: 0 });
});

test('server clock applies the measured offset', () => {
  const clock = new ServerClock();
  clock.sync(10_000, 7_000);
  expect(clock.now(8_000)).toBe(11_000);
});
