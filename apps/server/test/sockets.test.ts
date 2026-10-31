import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { DEFAULT_SETTINGS, type GameSettings } from '@wordbomb/shared';
import { createAndJoin, findWord, holderOf, startTestApp, type TestApp } from './helpers.ts';

let app: TestApp;

beforeAll(async () => {
  app = await startTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('rooms', () => {
  test('create, join by code, and both see the same members', async () => {
    const { host, others, roomId } = await createAndJoin(app, ['Ana', 'Ben']);
    expect(roomId).toMatch(/^[A-Z2-9]{6}$/);
    const state = await others[0]!.waitForState((s) => s.members.length === 2);
    expect(state.hostId).toBe(host.playerId);
    expect(state.members.map((m) => m.name)).toEqual(['Ana', 'Ben']);
    expect(state.game).toBeNull();
    expect(JSON.stringify(state)).not.toContain(host.profile.token);
  });

  test('joining the room you are already in is a harmless rejoin', async () => {
    const { host, roomId } = await createAndJoin(app, ['Ana']);
    const again = await host.join(roomId);
    expect(again).toEqual({ ok: true, playerId: host.playerId });
    const state = await host.waitForState((s) => s.members.length === 1);
    expect(state.hostId).toBe(host.playerId);
    expect(app.manager.get(roomId)?.members.size).toBe(1);
  });

  test('lowercase codes work and unknown or invalid joins are rejected', async () => {
    const { roomId } = await createAndJoin(app, ['Ana']);
    const lower = await app.client('Ben').join(roomId.toLowerCase());
    expect(lower.ok).toBe(true);
    const missing = await app.client('Cleo').join('ZZZZZZ');
    expect(missing).toMatchObject({ ok: false, error: { code: 'room_not_found' } });
    const invalid = await app.client('<b>').join(roomId);
    expect(invalid).toMatchObject({ ok: false, error: { code: 'invalid_payload' } });
  });

  test('public rooms are listed over REST, private ones are not', async () => {
    const { host, roomId } = await createAndJoin(app, ['Ana']);
    const before = (await (await fetch(`${app.url}/api/rooms`)).json()) as { id: string }[];
    expect(before.some((r) => r.id === roomId)).toBe(false);
    host.emit('room:setVisibility', { visibility: 'public' });
    await host.waitForState((s) => s.visibility === 'public');
    const after = (await (await fetch(`${app.url}/api/rooms`)).json()) as { id: string }[];
    expect(after.find((r) => r.id === roomId)).toMatchObject({ players: 1, status: 'waiting' });
  });

  test('host leaving transfers host and the room is deleted when empty', async () => {
    const { host, others, roomId } = await createAndJoin(app, ['Ana', 'Ben']);
    host.emit('room:leave');
    const state = await others[0]!.waitForState((s) => s.members.length === 1);
    expect(state.hostId).toBe(others[0]!.playerId);
    others[0]!.emit('room:leave');
    await new Promise((r) => setTimeout(r, 50));
    expect(app.manager.get(roomId)).toBeUndefined();
  });

  test('chat is broadcast with the sender name and rate limited', async () => {
    const { host, others } = await createAndJoin(app, ['Ana', 'Ben']);
    const message = others[0]!.waitFor('chat:message');
    host.emit('chat:send', { text: 'hello' });
    expect(await message).toMatchObject({ playerId: host.playerId, name: 'Ana', text: 'hello' });
    const error = host.waitFor('room:error');
    host.emit('chat:send', { text: 'again' });
    expect((await error).code).toBe('rate_limited');
  });

  test('non-host actions are refused with an error event', async () => {
    const { others } = await createAndJoin(app, ['Ana', 'Ben']);
    const error = others[0]!.waitFor('room:error');
    others[0]!.emit('game:start');
    expect((await error).code).toBe('not_host');
  });
});

describe('games', () => {
  async function startGame(names: string[], settings: GameSettings = DEFAULT_SETTINGS) {
    const room = await createAndJoin(app, names);
    room.host.emit('room:updateSettings', { settings });
    await room.host.waitForState((s) => s.settings.bombMaxSeconds === settings.bombMaxSeconds);
    room.host.emit('game:start');
    const state = await room.host.waitForState((s) => s.game?.status === 'playing');
    await Promise.all(room.others.map((c) => c.waitForState((s) => s.game?.status === 'playing')));
    const holder = room.all.find((c) => c.playerId === holderOf(state))!;
    const other = room.all.find((c) => c !== holder)!;
    return { ...room, state, holder, other };
  }

  test('turns rotate on accepted words and rejections explain why', async () => {
    const { state, holder, other } = await startGame(['Ana', 'Ben']);
    expect(state.game!.seats).toHaveLength(2);
    expect(state.game!.prompt.length).toBeGreaterThanOrEqual(2);

    const wrongTurn = await other.emitAck('word:submit', { word: 'anything' });
    expect(wrongTurn).toEqual({ accepted: false, reason: 'not_your_turn' });

    const bad = await holder.emitAck('word:submit', { word: 'qqqqq' });
    expect(bad.accepted).toBe(false);
    expect(['missing_prompt', 'not_a_word']).toContain(bad.reason);

    const word = findWord(state);
    const acceptedEvent = other.waitFor('word:accepted');
    const result = await holder.emitAck('word:submit', { word: word.toUpperCase() });
    expect(result).toEqual({ accepted: true });
    expect(await acceptedEvent).toMatchObject({ playerId: holder.playerId, word });
    const next = await other.waitForState((s) => s.game!.words.length === 1);
    expect(holderOf(next)).toBe(other.playerId);
    expect(next.game!.words).toEqual([{ playerId: holder.playerId, word }]);
  });

  test('a duplicate submit after the turn passed is refused', async () => {
    const { state, holder } = await startGame(['Ana', 'Ben']);
    const word = findWord(state);
    const [first, second] = await Promise.all([
      holder.emitAck('word:submit', { word }),
      holder.emitAck('word:submit', { word }),
    ]);
    expect(first).toEqual({ accepted: true });
    expect(second).toEqual({ accepted: false, reason: 'not_your_turn' });
  });

  test('typing previews reach other players', async () => {
    const { holder, other } = await startGame(['Ana', 'Ben']);
    const preview = other.waitFor('word:typing');
    holder.emit('word:typing', { text: 'ca' });
    expect(await preview).toEqual({ playerId: holder.playerId, text: 'ca' });
  });

  test('a refreshed player reconnects into the same seat mid-game', async () => {
    const { holder, other, roomId } = await startGame(['Ana', 'Ben']);
    holder.disconnect();
    const gone = await other.waitForState(
      (s) => s.members.find((m) => m.id === holder.playerId)?.connected === false,
    );
    expect(gone.game!.status).toBe('playing');

    const fresh = app.client('Ana');
    const rejoined = await fresh.emitAck('room:join', { ...holder.profile, roomId });
    expect(rejoined).toEqual({ ok: true, playerId: holder.playerId });
    const back = await fresh.waitForState((s) =>
      s.members.some((m) => m.id === holder.playerId && m.connected),
    );
    expect(back.game!.seats.some((s) => s.playerId === holder.playerId)).toBe(true);
    const word = findWord(back);
    expect(await fresh.emitAck('word:submit', { word })).toEqual({ accepted: true });
  });

  test('a player who leaves mid-game is eliminated and the last one wins', async () => {
    const { holder, other } = await startGame(['Ana', 'Ben']);
    const finished = other.waitFor('game:finished');
    holder.emit('room:leave');
    expect(await finished).toEqual({ winnerId: other.playerId });
    const state = await other.waitForState((s) => s.game?.status === 'finished');
    expect(state.members).toHaveLength(1);
  });

  test('late joiners spectate and are seated for the next game', async () => {
    const { host, roomId, others } = await startGame(['Ana', 'Ben']);
    const spectator = app.client('Cleo');
    const joined = await spectator.join(roomId);
    expect(joined.ok).toBe(true);
    const state = await spectator.waitForState((s) => s.members.length === 3);
    expect(state.game!.status).toBe('playing');
    expect(state.game!.seats).toHaveLength(2);
    others[0]!.emit('room:leave');
    await host.waitForState((s) => s.game?.status === 'finished');
    host.emit('game:start');
    const next = await spectator.waitForState((s) => s.gamesPlayed === 2);
    expect(next.game!.seats.map((s) => s.playerId).sort()).toEqual(
      [host.playerId, spectator.playerId].sort(),
    );
  });

  test('the bomb explodes on the server and costs a life', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      minTurnSeconds: 2,
      bombMinSeconds: 5,
      bombMaxSeconds: 5,
    };
    const { holder, other } = await startGame(['Ana', 'Ben'], settings);
    const exploded = await other.waitFor('bomb:exploded', () => true, 8_000);
    expect(exploded).toEqual({ playerId: holder.playerId, livesLeft: 1 });
    const state = await other.waitForState((s) => s.game!.seats.some((seat) => seat.lives === 1));
    expect(holderOf(state)).toBe(other.playerId);
  }, 15_000);
});
