import type { ServerToClientEvents } from '@wordbomb/shared';
import { Room, type RoomDeps } from './room.ts';

export interface Emitted {
  event: keyof ServerToClientEvents;
  payload: unknown;
  volatile: boolean;
}

export function createTestRoom(options: { words?: string[]; prompts?: string[] } = {}) {
  const emitted: Emitted[] = [];
  const words = new Set(options.words ?? ['cat', 'cats', 'scat', 'dog', 'dogs', 'cog']);
  const prompts = options.prompts ?? [''];
  let promptIndex = 0;
  const deps: RoomDeps = {
    now: () => Date.now(),
    rng: () => 0.5,
    dictionary: { has: (w) => words.has(w) },
    prompts: { pick: () => prompts[promptIndex++ % prompts.length]! },
    emit: (event, payload, volatile = false) => emitted.push({ event, payload, volatile }),
  };
  const room = new Room('ABCDEF', 'Test room', deps);
  const join = (name: string, token = `token-${name}-${'x'.repeat(12)}`) => {
    const result = room.join({ token, name, avatar: 'circle-happy', socketId: `sock-${name}` });
    if ('error' in result) throw new Error(result.error);
    return result.member;
  };
  const events = (event: keyof ServerToClientEvents) => emitted.filter((e) => e.event === event);
  const lastState = () => events('room:state').at(-1)?.payload as ReturnType<Room['snapshot']>;
  return { room, deps, emitted, join, events, lastState };
}
