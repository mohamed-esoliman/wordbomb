import { useSyncExternalStore } from 'react';
import {
  CHAT_HISTORY_LIMIT,
  type Ack,
  type ErrorPayload,
  type GameSettings,
  type RejectReason,
  type RoomSnapshot,
  type ServerToClientEvents,
  type Visibility,
} from '@wordbomb/shared';
import { ServerClock } from './clock.ts';
import type { Profile } from './profile.ts';
import type { ClientSocket } from './socket.ts';

export type Connection = 'idle' | 'connecting' | 'connected' | 'reconnecting';

export interface ClientState {
  connection: Connection;
  roomId: string | null;
  myId: string | null;
  room: RoomSnapshot | null;
  joinError: ErrorPayload | null;
  notice: ErrorPayload | null;
  typing: Record<string, string>;
  rejection: { word: string; reason: RejectReason; at: number } | null;
  finished: { winnerId: string | null; at: number } | null;
}

type EventName = keyof ServerToClientEvents;
type Handler<E extends EventName> = ServerToClientEvents[E];

const initialState: ClientState = {
  connection: 'idle',
  roomId: null,
  myId: null,
  room: null,
  joinError: null,
  notice: null,
  typing: {},
  rejection: null,
  finished: null,
};

export class RoomClient {
  readonly clock = new ServerClock();
  private state: ClientState = initialState;
  private readonly listeners = new Set<() => void>();
  private readonly handlers = new Map<EventName, Set<(payload: never) => void>>();
  private profile: Profile | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private leaveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly socket: ClientSocket) {
    socket.on('connect', () => {
      this.update({ connection: 'connected' });
      if (this.state.roomId && this.profile) this.sendJoin(this.state.roomId, this.profile);
    });
    socket.on('disconnect', () => {
      if (this.state.roomId) this.update({ connection: 'reconnecting' });
      else this.update({ connection: 'idle' });
    });
    socket.io.on('reconnect_attempt', () => {
      if (this.state.roomId) this.update({ connection: 'reconnecting' });
    });

    socket.on('room:state', (room) => {
      this.clock.sync(room.serverNow);
      const finished =
        room.game?.status === 'finished' &&
        !this.state.finished &&
        this.state.room?.game?.status === 'playing'
          ? { winnerId: room.game.winnerId, at: Date.now() }
          : this.state.finished;
      this.update({ room, typing: {}, finished });
      this.dispatch('room:state', room);
    });
    socket.on('word:typing', (payload) => {
      this.update({ typing: { ...this.state.typing, [payload.playerId]: payload.text } });
      this.dispatch('word:typing', payload);
    });
    socket.on('word:rejected', (payload) => {
      if (payload.playerId === this.state.myId) {
        this.update({ rejection: { word: payload.word, reason: payload.reason, at: Date.now() } });
      }
      this.dispatch('word:rejected', payload);
    });
    socket.on('game:finished', (payload) => {
      this.update({ finished: { winnerId: payload.winnerId, at: Date.now() } });
      this.dispatch('game:finished', payload);
    });
    socket.on('room:error', (error) => {
      this.showNotice(error);
      this.dispatch('room:error', error);
    });
    socket.on('chat:message', (message) => {
      if (this.state.room) {
        const chat = [...this.state.room.chat, message].slice(-CHAT_HISTORY_LIMIT);
        this.update({ room: { ...this.state.room, chat } });
      }
      this.dispatch('chat:message', message);
    });
    for (const event of [
      'word:accepted',
      'bomb:exploded',
      'player:lifeGained',
      'player:eliminated',
    ] as const) {
      socket.on(event, ((payload: never) => this.dispatch(event, payload)) as Handler<
        typeof event
      >);
    }
  }

  getState = (): ClientState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  on<E extends EventName>(event: E, handler: Handler<E>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (payload: never) => void);
    return () => set.delete(handler as (payload: never) => void);
  }

  get myId(): string | null {
    return this.state.myId;
  }

  create(profile: Profile, roomName?: string): Promise<Ack<{ roomId: string; playerId: string }>> {
    this.profile = profile;
    this.connect();
    return new Promise((resolve) => {
      this.socket.emit('room:create', { ...profile, roomName }, (reply) => {
        if (reply.ok) {
          this.update({
            roomId: reply.roomId,
            myId: reply.playerId,
            joinError: null,
            finished: null,
          });
        }
        resolve(reply);
      });
    });
  }

  join(roomId: string, profile: Profile): void {
    clearTimeout(this.leaveTimer);
    this.profile = profile;
    if (this.state.roomId === roomId && this.state.myId && this.socket.connected) return;
    if (this.state.roomId !== roomId) {
      this.update({ roomId, room: null, myId: null, joinError: null, finished: null, typing: {} });
    }
    this.connect();
    if (this.socket.connected) this.sendJoin(roomId, profile);
  }

  leave(): void {
    clearTimeout(this.leaveTimer);
    if (this.state.roomId) this.socket.emit('room:leave');
    this.update({ ...initialState, connection: this.socket.connected ? 'connected' : 'idle' });
  }

  scheduleLeave(): void {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = setTimeout(() => this.leave(), 0);
  }

  updateSettings(settings: GameSettings): void {
    this.socket.emit('room:updateSettings', { settings });
  }

  setVisibility(visibility: Visibility): void {
    this.socket.emit('room:setVisibility', { visibility });
  }

  updateProfile(name: string, avatar: string): void {
    if (this.profile) this.profile = { ...this.profile, name, avatar };
    this.socket.emit('member:updateProfile', { name, avatar });
  }

  setSeated(seated: boolean): void {
    this.socket.emit('member:setSeated', { seated });
  }

  startGame(): void {
    this.socket.emit('game:start');
  }

  typing(text: string): void {
    this.socket.volatile.emit('word:typing', { text });
  }

  submit(word: string): Promise<{ accepted: boolean; reason?: RejectReason }> {
    return new Promise((resolve) => this.socket.emit('word:submit', { word }, resolve));
  }

  chat(text: string): void {
    this.socket.emit('chat:send', { text });
  }

  dismissFinished(): void {
    this.update({ finished: null });
  }

  private connect(): void {
    if (!this.socket.connected) {
      this.update({ connection: 'connecting' });
      this.socket.connect();
    }
  }

  private sendJoin(roomId: string, profile: Profile): void {
    this.socket.emit('room:join', { ...profile, roomId }, (reply) => {
      if (this.state.roomId !== roomId) return;
      if (reply.ok) this.update({ myId: reply.playerId, joinError: null });
      else this.update({ joinError: reply.error });
    });
  }

  private showNotice(notice: ErrorPayload): void {
    clearTimeout(this.noticeTimer);
    this.update({ notice });
    this.noticeTimer = setTimeout(() => this.update({ notice: null }), 3000);
  }

  private dispatch<E extends EventName>(event: E, payload: Parameters<Handler<E>>[0]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) (handler as (p: typeof payload) => void)(payload);
  }

  private update(patch: Partial<ClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

export function useClientState(client: RoomClient): ClientState {
  return useSyncExternalStore(client.subscribe, client.getState, client.getState);
}
