import { expect, test } from 'vitest';
import { MEMBER_COLORS } from '@wordbomb/shared';
import { pickColor } from './colors.ts';
import { RateLimiter } from './rateLimit.ts';

test('allows up to the limit inside a window and recovers after it', () => {
  let now = 0;
  const limiter = new RateLimiter(() => now);
  expect(limiter.allow('ip:1', 2, 1000)).toBe(true);
  expect(limiter.allow('ip:1', 2, 1000)).toBe(true);
  expect(limiter.allow('ip:1', 2, 1000)).toBe(false);
  expect(limiter.allow('ip:2', 2, 1000)).toBe(true);
  now = 1000;
  expect(limiter.allow('ip:1', 2, 1000)).toBe(true);
});

test('forget and prune drop stored keys', () => {
  let now = 0;
  const limiter = new RateLimiter(() => now);
  limiter.allow('chat:a', 1, 1000);
  limiter.forget('chat:a');
  expect(limiter.allow('chat:a', 1, 1000)).toBe(true);
  now = 5000;
  limiter.prune(1000);
  expect(limiter.allow('chat:a', 1, 1000)).toBe(true);
});

test('pickColor prefers the least used color', () => {
  expect(pickColor([])).toBe(MEMBER_COLORS[0]);
  expect(pickColor([MEMBER_COLORS[0]])).toBe(MEMBER_COLORS[1]);
  const all = [...MEMBER_COLORS];
  expect(pickColor(all)).toBe(MEMBER_COLORS[0]);
  expect(pickColor([...all, MEMBER_COLORS[0]])).toBe(MEMBER_COLORS[1]);
});
