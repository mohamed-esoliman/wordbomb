import { expect, test } from 'vitest';
import { parseRoute, roomPath } from './router.ts';

test('room paths parse to uppercase room ids', () => {
  expect(parseRoute('/room/abc234')).toEqual({ page: 'room', roomId: 'ABC234' });
  expect(parseRoute('/room/ABC234/')).toEqual({ page: 'room', roomId: 'ABC234' });
});

test('anything else is home', () => {
  expect(parseRoute('/')).toEqual({ page: 'home' });
  expect(parseRoute('/room/short')).toEqual({ page: 'home' });
  expect(parseRoute('/room/toolong1')).toEqual({ page: 'home' });
  expect(parseRoute('/other')).toEqual({ page: 'home' });
});

test('roomPath builds the shareable path', () => {
  expect(roomPath('ABC234')).toBe('/room/ABC234');
});
