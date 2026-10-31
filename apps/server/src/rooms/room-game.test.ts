import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_SETTINGS, type RoomSnapshot } from '@wordbomb/shared';
import { DISCONNECT_GRACE_MS, type Room } from './room.ts';
import { createTestRoom } from './room-test-helpers.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

const holderOf = (room: Room) => room.game!.holderId;

function startedRoom(settings: Partial<typeof DEFAULT_SETTINGS> = {}) {
  const harness = createTestRoom();
  const ana = harness.join('Ana');
  const ben = harness.join('Ben');
  harness.room.updateSettings(ana.id, { ...DEFAULT_SETTINGS, ...settings });
  expect(harness.room.startGame(ana.id)).toBeNull();
  return { ...harness, ana, ben };
}

describe('starting a game', () => {
  test('requires the host and at least two seated connected members', () => {
    const { room, join } = createTestRoom();
    const ana = join('Ana');
    expect(room.startGame(ana.id)).toBe('not_enough_players');
    const ben = join('Ben');
    expect(room.startGame(ben.id)).toBe('not_host');
    room.setSeated(ben.id, false);
    expect(room.startGame(ana.id)).toBe('not_enough_players');
    room.setSeated(ben.id, true);
    room.markDisconnected(ben.id, 'sock-Ben');
    expect(room.startGame(ana.id)).toBe('not_enough_players');
  });

  test('seats members by join order up to maxPlayers and reports playing', () => {
    const { room, join, lastState } = createTestRoom();
    const ana = join('Ana');
    vi.advanceTimersByTime(1);
    const ben = join('Ben');
    vi.advanceTimersByTime(1);
    const cleo = join('Cleo');
    room.updateSettings(ana.id, { ...DEFAULT_SETTINGS, maxPlayers: 2 });
    expect(room.startGame(ana.id)).toBeNull();
    const seated = room.game!.seats.map((s) => s.playerId).sort();
    expect(seated).toEqual([ana.id, ben.id].sort());
    expect(room.isSeated(cleo.id)).toBe(false);
    expect(room.startGame(ana.id)).toBe('game_in_progress');
    expect(room.gamesPlayed).toBe(1);
    expect(room.summary().status).toBe('playing');
    const state = lastState();
    expect(state.game?.status).toBe('playing');
    expect(state.game?.seats).toHaveLength(2);
    expect(JSON.stringify(state)).not.toContain('explodeAt');
  });
});

describe('playing', () => {
  test('typing is forwarded as a volatile event for the holder only', () => {
    const { room, events, ana, ben } = startedRoom();
    const holder = holderOf(room);
    const other = holder === ana.id ? ben.id : ana.id;
    room.typing(other, 'no');
    room.typing(holder, 'ca');
    expect(events('word:typing')).toEqual([
      { event: 'word:typing', payload: { playerId: holder, text: 'ca' }, volatile: true },
    ]);
  });

  test('accepted words emit an event and a new snapshot, rejections only an event', () => {
    const { room, events, emitted } = startedRoom();
    const holder = holderOf(room);
    const before = events('room:state').length;
    expect(room.submitWord(holder, 'zzz')).toEqual({ accepted: false, reason: 'not_a_word' });
    expect(events('room:state')).toHaveLength(before);
    expect(events('word:rejected').at(-1)?.payload).toEqual({
      playerId: holder,
      word: 'zzz',
      reason: 'not_a_word',
    });
    expect(room.submitWord(holder, 'cat')).toEqual({ accepted: true });
    expect(events('room:state')).toHaveLength(before + 1);
    expect(emitted.at(-2)?.event).toBe('word:accepted');
    expect(holderOf(room)).not.toBe(holder);
  });

  test('the bomb explodes on the server timer and the turn passes', () => {
    const { room, events, lastState } = startedRoom({ bombMinSeconds: 10, bombMaxSeconds: 10 });
    const holder = holderOf(room);
    vi.advanceTimersByTime(9_999);
    expect(events('bomb:exploded')).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events('bomb:exploded').at(-1)?.payload).toEqual({ playerId: holder, livesLeft: 1 });
    expect(holderOf(room)).not.toBe(holder);
    const seat = lastState().game!.seats.find((s) => s.playerId === holder)!;
    expect(seat.lives).toBe(1);
  });

  test('a late accepted word pushes the explosion back by the minimum turn', () => {
    const { room, events } = startedRoom({
      bombMinSeconds: 10,
      bombMaxSeconds: 10,
      minTurnSeconds: 5,
    });
    vi.advanceTimersByTime(9_000);
    room.submitWord(holderOf(room), 'cat');
    vi.advanceTimersByTime(4_999);
    expect(events('bomb:exploded')).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events('bomb:exploded')).toHaveLength(1);
  });

  test('the game finishes with a winner and can be restarted', () => {
    const { room, events, ana } = startedRoom({
      startingLives: 1,
      bombMinSeconds: 5,
      bombMaxSeconds: 5,
    });
    const loser = holderOf(room);
    const winner = room.game!.seats.find((s) => s.playerId !== loser)!.playerId;
    vi.advanceTimersByTime(5_000);
    expect(events('game:finished').at(-1)?.payload).toEqual({ winnerId: winner });
    expect(room.isPlaying).toBe(false);
    expect(room.summary().status).toBe('waiting');
    vi.advanceTimersByTime(60_000);
    expect(events('bomb:exploded')).toHaveLength(1);
    expect(room.startGame(ana.id)).toBeNull();
    expect(room.gamesPlayed).toBe(2);
  });
});

describe('members during a game', () => {
  test('a seated member who disconnects keeps their seat past the grace period', () => {
    const { room, ana, ben } = startedRoom();
    room.markDisconnected(ana.id, 'sock-Ana');
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS);
    expect(room.members.has(ana.id)).toBe(true);
    expect(room.hostId).toBe(ben.id);
    expect(room.isSeated(ana.id)).toBe(true);
  });

  test('a still-disconnected member is dropped when the game ends', () => {
    const { room, ana, ben, events } = startedRoom({ startingLives: 1 });
    room.markDisconnected(ana.id, 'sock-Ana');
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS);
    vi.advanceTimersByTime(120_000);
    expect(events('game:finished')).toHaveLength(1);
    expect(room.members.has(ana.id)).toBe(false);
    expect(room.members.has(ben.id)).toBe(true);
    expect(room.hostId).toBe(ben.id);
  });

  test('leaving mid-game eliminates the player and can decide the game', () => {
    const { room, join, ana, ben, events } = startedRoom();
    const cleo = join('Cleo');
    expect(room.isSeated(cleo.id)).toBe(false);
    const holder = holderOf(room);
    room.leave(holder);
    expect(events('player:eliminated').at(-1)?.payload).toEqual({ playerId: holder });
    expect(events('game:finished').at(-1)?.payload).toEqual({
      winnerId: holder === ana.id ? ben.id : ana.id,
    });
    expect(room.members.size).toBe(2);
  });

  test('settings are frozen and seated players cannot rename during a game', () => {
    const { room, join, ana } = startedRoom();
    const cleo = join('Cleo');
    expect(room.updateSettings(ana.id, DEFAULT_SETTINGS)).toBe('game_in_progress');
    expect(room.updateProfile(ana.id, 'Anna', 'hex-cool')).toBe('game_in_progress');
    expect(room.updateProfile(cleo.id, 'Chloe', 'hex-cool')).toBeNull();
    expect(room.setVisibility(ana.id, 'public')).toBeNull();
  });

  test('spectators are seated in the next game', () => {
    const { room, join, ana, events } = startedRoom({
      startingLives: 1,
      bombMinSeconds: 5,
      bombMaxSeconds: 5,
    });
    const cleo = join('Cleo');
    vi.advanceTimersByTime(5_000);
    expect(events('game:finished')).toHaveLength(1);
    const host = room.hostId;
    expect([ana.id, host]).toContain(host);
    expect(room.startGame(host)).toBeNull();
    expect(room.isSeated(cleo.id)).toBe(true);
    expect(room.game!.seats).toHaveLength(3);
  });

  test('dispose stops the explosion timer', () => {
    const { room, events } = startedRoom({ bombMinSeconds: 5, bombMaxSeconds: 5 });
    room.dispose();
    vi.advanceTimersByTime(10_000);
    expect(events('bomb:exploded')).toHaveLength(0);
  });
});

test('snapshot type stays serializable', () => {
  const { room, join } = createTestRoom();
  join('Ana');
  const snapshot: RoomSnapshot = room.snapshot();
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
});
