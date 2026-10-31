import { afterAll, beforeAll, expect, test } from 'vitest';
import { startTestApp } from './helpers.ts';

let app: Awaited<ReturnType<typeof startTestApp>>;

beforeAll(async () => {
  app = await startTestApp();
});

afterAll(async () => {
  await app.close();
});

test('health endpoint responds', async () => {
  const res = await fetch(`${app.url}/healthz`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, rooms: 0 });
});

test('public room list starts empty', async () => {
  const res = await fetch(`${app.url}/api/rooms`);
  expect(await res.json()).toEqual([]);
});
