import { nanoid } from 'nanoid';
import {
  CHAT_HISTORY_LIMIT,
  DEFAULT_SETTINGS,
  MAX_ROOM_MEMBERS,
  type ChatMessage,
  type ErrorCode,
  type GameSettings,
  type PublicRoomSummary,
  type RoomSnapshot,
  type ServerToClientEvents,
  type Visibility,
} from '@wordbomb/shared';
import type { EngineDeps } from '../engine/game.ts';
import { pickColor } from './colors.ts';

export const DISCONNECT_GRACE_MS = 30_000;

export interface Member {
  id: string;
  token: string;
  socketId: string | null;
  name: string;
  avatar: string;
  color: string;
  connected: boolean;
  disconnectedAt: number | null;
  joinedAt: number;
  wantsToPlay: boolean;
}

export type Emit = <E extends keyof ServerToClientEvents>(
  event: E,
  payload: Parameters<ServerToClientEvents[E]>[0],
  volatile?: boolean,
) => void;

export interface RoomDeps extends EngineDeps {
  emit: Emit;
}

export interface JoinInput {
  token: string;
  name: string;
  avatar: string;
  socketId: string;
}

export type JoinResult = { member: Member; rejoined: boolean } | { error: ErrorCode };

export class Room {
  readonly id: string;
  name: string;
  hostId = '';
  visibility: Visibility = 'private';
  settings: GameSettings;
  readonly members = new Map<string, Member>();
  readonly chat: ChatMessage[] = [];
  gamesPlayed = 0;
  readonly createdAt: number;
  lastActivityAt: number;
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();
  private readonly deps: RoomDeps;

  constructor(id: string, name: string, deps: RoomDeps, settings: GameSettings = DEFAULT_SETTINGS) {
    this.id = id;
    this.name = name;
    this.deps = deps;
    this.settings = { ...settings };
    this.createdAt = deps.now();
    this.lastActivityAt = this.createdAt;
  }

  get isEmpty(): boolean {
    return this.members.size === 0;
  }

  hasConnectedMembers(): boolean {
    for (const member of this.members.values()) if (member.connected) return true;
    return false;
  }

  join(input: JoinInput): JoinResult {
    const existing = this.findByToken(input.token);
    if (existing) {
      this.clearGrace(existing.id);
      existing.connected = true;
      existing.disconnectedAt = null;
      existing.socketId = input.socketId;
      this.broadcast();
      return { member: existing, rejoined: true };
    }

    if (this.members.size >= MAX_ROOM_MEMBERS) return { error: 'room_full' };

    const member: Member = {
      id: nanoid(10),
      token: input.token,
      socketId: input.socketId,
      name: input.name,
      avatar: input.avatar,
      color: pickColor([...this.members.values()].map((m) => m.color)),
      connected: true,
      disconnectedAt: null,
      joinedAt: this.deps.now(),
      wantsToPlay: true,
    };
    this.members.set(member.id, member);
    if (!this.hostId) this.hostId = member.id;
    this.broadcast();
    return { member, rejoined: false };
  }

  markDisconnected(memberId: string, socketId: string): void {
    const member = this.members.get(memberId);
    if (!member || member.socketId !== socketId) return;
    member.connected = false;
    member.disconnectedAt = this.deps.now();
    member.socketId = null;
    this.clearGrace(memberId);
    this.graceTimers.set(
      memberId,
      setTimeout(() => this.onGraceExpired(memberId), DISCONNECT_GRACE_MS),
    );
    this.broadcast();
  }

  leave(memberId: string): void {
    if (!this.members.has(memberId)) return;
    this.removeMember(memberId);
    this.broadcast();
  }

  updateSettings(memberId: string, settings: GameSettings): ErrorCode | null {
    if (this.hostId !== memberId) return 'not_host';
    this.settings = { ...settings };
    this.broadcast();
    return null;
  }

  setVisibility(memberId: string, visibility: Visibility): ErrorCode | null {
    if (this.hostId !== memberId) return 'not_host';
    this.visibility = visibility;
    this.broadcast();
    return null;
  }

  updateProfile(memberId: string, name: string, avatar: string): ErrorCode | null {
    const member = this.members.get(memberId);
    if (!member) return 'not_in_room';
    member.name = name;
    member.avatar = avatar;
    this.broadcast();
    return null;
  }

  setSeated(memberId: string, seated: boolean): ErrorCode | null {
    const member = this.members.get(memberId);
    if (!member) return 'not_in_room';
    member.wantsToPlay = seated;
    this.broadcast();
    return null;
  }

  sendChat(memberId: string, text: string): ChatMessage | null {
    const member = this.members.get(memberId);
    if (!member) return null;
    const message: ChatMessage = {
      id: nanoid(8),
      playerId: memberId,
      name: member.name,
      text,
      at: this.deps.now(),
    };
    this.chat.push(message);
    if (this.chat.length > CHAT_HISTORY_LIMIT)
      this.chat.splice(0, this.chat.length - CHAT_HISTORY_LIMIT);
    this.lastActivityAt = message.at;
    this.deps.emit('chat:message', message);
    return message;
  }

  snapshot(): RoomSnapshot {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      visibility: this.visibility,
      settings: { ...this.settings },
      members: [...this.members.values()].map((m) => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        color: m.color,
        connected: m.connected,
        wantsToPlay: m.wantsToPlay,
        joinedAt: m.joinedAt,
      })),
      chat: [...this.chat],
      game: null,
      gamesPlayed: this.gamesPlayed,
      serverNow: this.deps.now(),
    };
  }

  summary(): PublicRoomSummary {
    let players = 0;
    for (const member of this.members.values()) if (member.connected) players++;
    return {
      id: this.id,
      name: this.name,
      players,
      maxPlayers: this.settings.maxPlayers,
      status: 'waiting',
    };
  }

  dispose(): void {
    for (const timer of this.graceTimers.values()) clearTimeout(timer);
    this.graceTimers.clear();
  }

  private findByToken(token: string): Member | undefined {
    for (const member of this.members.values()) if (member.token === token) return member;
    return undefined;
  }

  private onGraceExpired(memberId: string): void {
    this.graceTimers.delete(memberId);
    const member = this.members.get(memberId);
    if (!member || member.connected) return;
    this.removeMember(memberId);
    this.broadcast();
  }

  private removeMember(memberId: string): void {
    this.clearGrace(memberId);
    this.members.delete(memberId);
    if (this.hostId === memberId) this.transferHost();
  }

  private transferHost(): void {
    const byJoin = [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    const next = byJoin.find((m) => m.connected) ?? byJoin[0];
    this.hostId = next?.id ?? '';
  }

  private clearGrace(memberId: string): void {
    const timer = this.graceTimers.get(memberId);
    if (timer) clearTimeout(timer);
    this.graceTimers.delete(memberId);
  }

  private broadcast(): void {
    this.lastActivityAt = this.deps.now();
    this.deps.emit('room:state', this.snapshot());
  }
}
