import { expect, test } from 'vitest';
import { AVATAR_IDS } from './avatars.ts';
import { NameSchema, RoomCodeSchema, RoomJoinSchema, TokenSchema } from './events.ts';

test('names are trimmed and limited to safe characters', () => {
  expect(NameSchema.parse('  Mo  ')).toBe('Mo');
  expect(NameSchema.safeParse('').success).toBe(false);
  expect(NameSchema.safeParse('a'.repeat(17)).success).toBe(false);
  expect(NameSchema.safeParse('<script>').success).toBe(false);
  expect(NameSchema.safeParse("Zoë O'Neil-1").success).toBe(true);
});

test('room codes are normalized to uppercase', () => {
  expect(RoomCodeSchema.parse(' abcd23 ')).toBe('ABCD23');
  expect(RoomCodeSchema.safeParse('ABC').success).toBe(false);
  expect(RoomCodeSchema.safeParse('ABCD01').success).toBe(false);
});

test('tokens must be long url-safe strings', () => {
  expect(TokenSchema.safeParse('short').success).toBe(false);
  expect(TokenSchema.safeParse('8f1c2a4b-7d3e-4f6a-9b1c-2d3e4f5a6b7c').success).toBe(true);
});

test('join payload validates avatar ids', () => {
  const base = { roomId: 'ABCDEF', name: 'Mo', token: 'x'.repeat(20) };
  expect(RoomJoinSchema.safeParse({ ...base, avatar: AVATAR_IDS[0] }).success).toBe(true);
  expect(RoomJoinSchema.safeParse({ ...base, avatar: 'nope' }).success).toBe(false);
  expect(AVATAR_IDS).toHaveLength(16);
});
