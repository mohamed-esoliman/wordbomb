import { expect, test } from 'vitest';
import { generateRoomCode } from './codes.ts';

test('codes are six characters from the unambiguous alphabet', () => {
  for (let i = 0; i < 200; i++) {
    expect(generateRoomCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  }
});

test('codes follow the injected index picker', () => {
  expect(generateRoomCode(() => 0)).toBe('AAAAAA');
  expect(generateRoomCode((max) => max - 1)).toBe('999999');
});
