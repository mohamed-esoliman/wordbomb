import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, RoomSnapshot, ServerToClientEvents } from '@wordbomb/shared';
import { createApp, type AppOptions } from '../src/app.ts';
import { loadDefaultDictionary, type Dictionary } from '../src/dictionary/dictionary.ts';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type EventName = keyof ServerToClientEvents;
type Payload<E extends EventName> = Parameters<ServerToClientEvents[E]>[0];
type AckReply<E extends keyof ClientToServerEvents> =
  Parameters<ClientToServerEvents[E]> extends [unknown, (reply: infer R) => void] ? R : never;

interface LooseSocket {
  emit(event: string, ...args: unknown[]): void;
  on(event: string, handler: (payload: unknown) => void): void;
  off(event: string, handler: (payload: unknown) => void): void;
}

let sharedDictionary: Dictionary | undefined;
export function dictionary(): Dictionary {
  sharedDictionary ??= loadDefaultDictionary();
  return sharedDictionary;
}

export class TestClient {
  readonly socket: ClientSocket;
  readonly profile: { name: string; avatar: string; token: string };
  state: RoomSnapshot | null = null;
  playerId = '';
  private readonly stateWaiters = new Set<(state: RoomSnapshot) => void>();

  constructor(url: string, name: string) {
    this.profile = { name, avatar: 'circle-happy', token: randomUUID() };
    this.socket = connect(url, { forceNew: true, reconnection: false });
    this.socket.on('room:state', (state) => {
      this.state = state;
      for (const waiter of [...this.stateWaiters]) waiter(state);
    });
  }

  private get loose(): LooseSocket {
    return this.socket as unknown as LooseSocket;
  }

  emit<E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]> extends [infer P, ...unknown[]] ? [P] : []
  ): void {
    this.loose.emit(event, ...args);
  }

  emitAck<E extends keyof ClientToServerEvents>(
    event: E,
    payload: Parameters<ClientToServerEvents[E]>[0],
  ): Promise<AckReply<E>> {
    return new Promise((resolve) => this.loose.emit(event, payload, resolve));
  }

  waitFor<E extends EventName>(
    event: E,
    predicate: (payload: Payload<E>) => boolean = () => true,
    timeoutMs = 3_000,
  ): Promise<Payload<E>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.loose.off(event, handler);
        reject(new Error(`timed out waiting for ${event}`));
      }, timeoutMs);
      const handler = (payload: unknown) => {
        if (!predicate(payload as Payload<E>)) return;
        clearTimeout(timer);
        this.loose.off(event, handler);
        resolve(payload as Payload<E>);
      };
      this.loose.on(event, handler);
    });
  }

  waitForState(
    predicate: (state: RoomSnapshot) => boolean,
    timeoutMs = 3_000,
  ): Promise<RoomSnapshot> {
    if (this.state && predicate(this.state)) return Promise.resolve(this.state);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stateWaiters.delete(waiter);
        reject(new Error('timed out waiting for room state'));
      }, timeoutMs);
      const waiter = (state: RoomSnapshot) => {
        if (!predicate(state)) return;
        clearTimeout(timer);
        this.stateWaiters.delete(waiter);
        resolve(state);
      };
      this.stateWaiters.add(waiter);
    });
  }

  async create(roomName?: string): Promise<string> {
    const reply = await this.emitAck('room:create', { ...this.profile, roomName });
    if (!reply.ok) throw new Error(reply.error.code);
    this.playerId = reply.playerId;
    await this.waitForState((s) => s.members.length >= 1);
    return reply.roomId;
  }

  async join(roomId: string): Promise<AckReply<'room:join'>> {
    const reply = await this.emitAck('room:join', { ...this.profile, roomId });
    if (reply.ok) this.playerId = reply.playerId;
    return reply;
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}

export async function startTestApp(options: AppOptions = {}) {
  const app = createApp({
    dictionary: dictionary(),
    cleanupIntervalMs: 3_600_000,
    limits: { create: { limit: 1000, windowMs: 60_000 }, join: { limit: 1000, windowMs: 60_000 } },
    ...options,
  });
  await new Promise<void>((resolve) => app.httpServer.listen(0, resolve));
  const { port } = app.httpServer.address() as AddressInfo;
  const url = `http://localhost:${port}`;
  const clients: TestClient[] = [];
  const client = (name: string): TestClient => {
    const c = new TestClient(url, name);
    clients.push(c);
    return c;
  };
  const close = async () => {
    for (const c of clients) c.disconnect();
    await app.close();
  };
  return { ...app, url, client, close };
}

export type TestApp = Awaited<ReturnType<typeof startTestApp>>;

export async function createAndJoin(app: TestApp, names: string[]) {
  const [hostName, ...rest] = names;
  const host = app.client(hostName!);
  const roomId = await host.create();
  const others: TestClient[] = [];
  for (const name of rest) {
    const c = app.client(name);
    const reply = await c.join(roomId);
    if (!reply.ok) throw new Error(reply.error.code);
    others.push(c);
  }
  await host.waitForState((s) => s.members.length === names.length);
  return { roomId, host, others, all: [host, ...others] };
}

export function findWord(state: RoomSnapshot, minLength = 3): string {
  const prompt = state.game!.prompt;
  const used = new Set(state.game!.words.map((w) => w.word));
  const word = dictionary().words.find(
    (w) => w.length >= minLength && w.includes(prompt) && !used.has(w),
  );
  if (!word) throw new Error(`no word for prompt ${prompt}`);
  return word;
}

export const holderOf = (state: RoomSnapshot) => state.game!.seats[state.game!.turnIndex]!.playerId;
