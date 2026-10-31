import { afterAll, beforeAll, expect, test } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

const { httpServer, io } = createApp();
let url = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  url = `http://localhost:${port}`;
});

afterAll(async () => {
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

test('health endpoint responds', async () => {
  const res = await fetch(`${url}/healthz`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test('socket round-trips a ping', async () => {
  const socket: Socket = connect(url);
  const reply = await new Promise<string>((resolve) => {
    socket.emit('ping', (r: string) => resolve(r));
  });
  expect(reply).toBe('pong');
  socket.disconnect();
});
