import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RoomManager, ROOM_IDLE_MS, type RoomEmit } from './roomManager.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(5_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

function createManager(overrides: { maxRooms?: number; codes?: string[] } = {}) {
  const emitted: { roomId: string; event: string }[] = [];
  const codes = overrides.codes ? [...overrides.codes] : null;
  const emit: RoomEmit = (roomId, event) => {
    emitted.push({ roomId, event });
  };
  const manager = new RoomManager({
    now: () => Date.now(),
    rng: () => 0.5,
    dictionary: { has: () => true },
    prompts: { pick: () => '' },
    emit,
    maxRooms: overrides.maxRooms,
    generateCode: codes ? () => codes.shift() ?? 'ZZZZZZ' : undefined,
  });
  return { manager, emitted };
}

const profile = (name: string) => ({
  token: `token-${name}-${'x'.repeat(12)}`,
  name,
  avatar: 'circle-happy',
  socketId: `sock-${name}`,
});

test('creates rooms with unique codes and routes emits by room id', () => {
  const { manager, emitted } = createManager({ codes: ['AAAAAA', 'AAAAAA', 'BBBBBB'] });
  const a = manager.create('one')!;
  const b = manager.create('two')!;
  expect(a.id).toBe('AAAAAA');
  expect(b.id).toBe('BBBBBB');
  b.join(profile('Ana'));
  expect(emitted).toEqual([{ roomId: 'BBBBBB', event: 'room:state' }]);
  expect(manager.get('AAAAAA')).toBe(a);
  expect(manager.get('nope')).toBeUndefined();
});

test('refuses to create rooms beyond the cap', () => {
  const { manager } = createManager({ maxRooms: 1 });
  expect(manager.create('one')).not.toBeNull();
  expect(manager.create('two')).toBeNull();
});

test('lists only public rooms with connected members, most active first', () => {
  const { manager } = createManager();
  const pub = manager.create('pub')!;
  const priv = manager.create('priv')!;
  const empty = manager.create('empty')!;
  const ana = pub.join(profile('Ana'));
  priv.join(profile('Ben'));
  empty.setVisibility('', 'public');
  if ('member' in ana) pub.setVisibility(ana.member.id, 'public');
  vi.advanceTimersByTime(10);
  const cleo = priv.join(profile('Cleo'));
  if ('member' in cleo) priv.setVisibility(priv.hostId, 'public');
  const listed = manager.listPublic();
  expect(listed.map((r) => r.name)).toEqual(['priv', 'pub']);
  expect(listed[1]).toEqual({
    id: pub.id,
    name: 'pub',
    players: 1,
    maxPlayers: 8,
    status: 'waiting',
  });
});

test('cleanup drops empty rooms and rooms idle without connections', () => {
  const { manager } = createManager();
  const empty = manager.create('empty')!;
  const idle = manager.create('idle')!;
  const live = manager.create('live')!;
  const ana = idle.join(profile('Ana'));
  live.join(profile('Ben'));
  if ('member' in ana) idle.markDisconnected(ana.member.id, 'sock-Ana');
  expect(manager.cleanup()).toBe(1);
  expect(manager.get(empty.id)).toBeUndefined();
  vi.advanceTimersByTime(ROOM_IDLE_MS);
  expect(manager.cleanup()).toBe(1);
  expect(manager.get(idle.id)).toBeUndefined();
  expect(manager.get(live.id)).toBe(live);
});

test('removeIfEmpty and the cleanup interval dispose rooms', () => {
  const { manager } = createManager();
  const room = manager.create('room')!;
  const ana = room.join(profile('Ana'));
  expect(manager.removeIfEmpty(room.id)).toBe(false);
  if ('member' in ana) room.leave(ana.member.id);
  expect(manager.removeIfEmpty(room.id)).toBe(true);
  manager.create('later');
  manager.startCleanup(1_000);
  vi.advanceTimersByTime(1_000);
  expect(manager.rooms.size).toBe(0);
  manager.stop();
});
