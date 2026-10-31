import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@wordbomb/shared';
import { DISCONNECT_GRACE_MS } from './room.ts';
import { createTestRoom } from './room-test-helpers.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('joining', () => {
  test('first member becomes host and every join broadcasts state', () => {
    const { room, join, lastState, events } = createTestRoom();
    const ana = join('Ana');
    expect(room.hostId).toBe(ana.id);
    const ben = join('Ben');
    expect(room.hostId).toBe(ana.id);
    expect(ben.color).not.toBe(ana.color);
    expect(events('room:state')).toHaveLength(2);
    const state = lastState();
    expect(state.members.map((m) => m.name)).toEqual(['Ana', 'Ben']);
    expect(JSON.stringify(state)).not.toContain('token');
    expect(state.game).toBeNull();
  });

  test('a member rejoining with the same token keeps their seat', () => {
    const { room, join } = createTestRoom();
    const ana = join('Ana');
    room.markDisconnected(ana.id, 'sock-Ana');
    expect(room.members.get(ana.id)?.connected).toBe(false);
    const result = room.join({
      token: ana.token,
      name: 'Ana',
      avatar: 'circle-happy',
      socketId: 'sock-2',
    });
    expect(result).toMatchObject({ rejoined: true, member: { id: ana.id, connected: true } });
    expect(room.members.size).toBe(1);
  });

  test('a stale disconnect from a replaced socket is ignored', () => {
    const { room, join } = createTestRoom();
    const ana = join('Ana');
    room.join({ token: ana.token, name: 'Ana', avatar: 'circle-happy', socketId: 'sock-new' });
    room.markDisconnected(ana.id, 'sock-Ana');
    expect(room.members.get(ana.id)?.connected).toBe(true);
  });

  test('rejects joins beyond the member cap', () => {
    const { room, join } = createTestRoom();
    for (let i = 0; i < 12; i++) join(`p${i}`);
    const result = room.join({
      token: 'overflow-token-xxxxxxxx',
      name: 'Late',
      avatar: 'circle-happy',
      socketId: 's',
    });
    expect(result).toEqual({ error: 'room_full' });
  });
});

describe('disconnects and host transfer', () => {
  test('a disconnected lobby member is removed after the grace period', () => {
    const { room, join } = createTestRoom();
    const ana = join('Ana');
    const ben = join('Ben');
    room.markDisconnected(ana.id, 'sock-Ana');
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS - 1);
    expect(room.members.has(ana.id)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(room.members.has(ana.id)).toBe(false);
    expect(room.hostId).toBe(ben.id);
  });

  test('reconnecting inside the grace period cancels removal', () => {
    const { room, join } = createTestRoom();
    const ana = join('Ana');
    room.markDisconnected(ana.id, 'sock-Ana');
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS / 2);
    room.join({ token: ana.token, name: 'Ana', avatar: 'circle-happy', socketId: 's2' });
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS);
    expect(room.members.has(ana.id)).toBe(true);
  });

  test('leaving transfers host to the longest-present connected member', () => {
    const { room, join } = createTestRoom();
    const ana = join('Ana');
    vi.advanceTimersByTime(10);
    const ben = join('Ben');
    vi.advanceTimersByTime(10);
    const cleo = join('Cleo');
    room.markDisconnected(ben.id, 'sock-Ben');
    room.leave(ana.id);
    expect(room.hostId).toBe(cleo.id);
    room.leave(cleo.id);
    expect(room.hostId).toBe(ben.id);
    room.leave(ben.id);
    expect(room.isEmpty).toBe(true);
    expect(room.hostId).toBe('');
  });
});

describe('lobby actions', () => {
  test('only the host can change settings and visibility', () => {
    const { room, join, lastState } = createTestRoom();
    const ana = join('Ana');
    const ben = join('Ben');
    const settings = { ...DEFAULT_SETTINGS, startingLives: 4, maxLives: 5 };
    expect(room.updateSettings(ben.id, settings)).toBe('not_host');
    expect(room.updateSettings(ana.id, settings)).toBeNull();
    expect(room.settings.startingLives).toBe(4);
    expect(room.setVisibility(ben.id, 'public')).toBe('not_host');
    expect(room.setVisibility(ana.id, 'public')).toBeNull();
    expect(lastState().visibility).toBe('public');
    expect(room.summary()).toEqual({
      id: 'ABCDEF',
      name: 'Test room',
      players: 2,
      maxPlayers: 8,
      status: 'waiting',
    });
  });

  test('members can update their profile and seat preference', () => {
    const { room, join, lastState } = createTestRoom();
    const ana = join('Ana');
    expect(room.updateProfile(ana.id, 'Anna', 'hex-cool')).toBeNull();
    expect(room.setSeated(ana.id, false)).toBeNull();
    expect(lastState().members[0]).toMatchObject({
      name: 'Anna',
      avatar: 'hex-cool',
      wantsToPlay: false,
    });
    expect(room.updateProfile('ghost', 'x', 'hex-cool')).toBe('not_in_room');
  });

  test('chat is emitted and history is capped', () => {
    const { room, join, events, lastState } = createTestRoom();
    const ana = join('Ana');
    for (let i = 0; i < 55; i++) room.sendChat(ana.id, `msg ${i}`);
    expect(events('chat:message')).toHaveLength(55);
    expect(room.chat).toHaveLength(50);
    expect(room.chat[0]?.text).toBe('msg 5');
    expect(events('chat:message')[0]?.payload).toMatchObject({ name: 'Ana', text: 'msg 0' });
    room.setSeated(ana.id, true);
    expect(lastState().chat).toHaveLength(50);
    expect(room.sendChat('ghost', 'hi')).toBeNull();
  });
});
