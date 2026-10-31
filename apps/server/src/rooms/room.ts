import { nanoid } from 'nanoid';
import {
  CHAT_HISTORY_LIMIT,
  DEFAULT_SETTINGS,
  MAX_ROOM_MEMBERS,
  type ChatMessage,
  type ErrorCode,
  type GameSettings,
  type PublicRoomSummary,
  type RejectReason,
  type RoomSnapshot,
  type ServerToClientEvents,
  type Visibility,
} from '@wordbomb/shared';
import { Game, type EngineDeps, type GameEvent } from '../engine/game.ts';
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

export interface SubmitResult {
  accepted: boolean;
  reason?: RejectReason;
}

export class Room {
  readonly id: string;
  name: string;
  hostId = '';
  visibility: Visibility = 'private';
  settings: GameSettings;
  readonly members = new Map<string, Member>();
  readonly chat: ChatMessage[] = [];
  game: Game | null = null;
  gamesPlayed = 0;
  readonly createdAt: number;
  lastActivityAt: number;
  private explosionTimer: NodeJS.Timeout | undefined;
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

  get isPlaying(): boolean {
    return this.game?.status === 'playing';
  }

  hasConnectedMembers(): boolean {
    for (const member of this.members.values()) if (member.connected) return true;
    return false;
  }

  isSeated(memberId: string): boolean {
    if (!this.isPlaying) return false;
    return this.game!.seats.some((s) => s.playerId === memberId && !s.eliminated);
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
    if (this.isPlaying) return 'game_in_progress';
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
    if (this.isSeated(memberId)) return 'game_in_progress';
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

  startGame(memberId: string): ErrorCode | null {
    if (this.hostId !== memberId) return 'not_host';
    if (this.isPlaying) return 'game_in_progress';
    const players = [...this.members.values()]
      .filter((m) => m.connected && m.wantsToPlay)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .slice(0, this.settings.maxPlayers)
      .map((m) => m.id);
    if (players.length < 2) return 'not_enough_players';

    this.game = new Game(this.settings, players, this.deps);
    this.gamesPlayed += 1;
    this.handleEngineEvents(this.game.start());
    this.broadcast();
    return null;
  }

  typing(memberId: string, text: string): void {
    if (this.game?.setInput(memberId, text)) {
      this.deps.emit(
        'word:typing',
        { playerId: memberId, text: this.game.holder.currentInput },
        true,
      );
    }
  }

  submitWord(memberId: string, word: string): SubmitResult {
    if (!this.game) return { accepted: false, reason: 'game_over' };
    const events = this.game.submitWord(memberId, word);
    this.handleEngineEvents(events);
    const rejected = events.find((e) => e.type === 'word_rejected');
    if (rejected) return { accepted: false, reason: rejected.reason };
    this.broadcast();
    return { accepted: true };
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
      game: this.game?.toSnapshot() ?? null,
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
      status: this.isPlaying ? 'playing' : 'waiting',
    };
  }

  dispose(): void {
    for (const timer of this.graceTimers.values()) clearTimeout(timer);
    this.graceTimers.clear();
    clearTimeout(this.explosionTimer);
    this.explosionTimer = undefined;
  }

  private findByToken(token: string): Member | undefined {
    for (const member of this.members.values()) if (member.token === token) return member;
    return undefined;
  }

  private onGraceExpired(memberId: string): void {
    this.graceTimers.delete(memberId);
    const member = this.members.get(memberId);
    if (!member || member.connected) return;
    if (this.isSeated(memberId)) {
      if (this.hostId === memberId) this.transferHost();
    } else {
      this.removeMember(memberId);
    }
    this.broadcast();
  }

  private removeMember(memberId: string): void {
    this.clearGrace(memberId);
    this.members.delete(memberId);
    if (this.isPlaying) this.handleEngineEvents(this.game!.removePlayer(memberId));
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

  private handleEngineEvents(events: GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'turn_started':
          break;
        case 'word_accepted':
          this.deps.emit('word:accepted', {
            playerId: event.playerId,
            word: event.word,
            newLetters: event.newLetters,
          });
          break;
        case 'word_rejected':
          this.deps.emit('word:rejected', {
            playerId: event.playerId,
            word: event.word,
            reason: event.reason,
          });
          break;
        case 'bomb_exploded':
          this.deps.emit('bomb:exploded', { playerId: event.playerId, livesLeft: event.livesLeft });
          break;
        case 'life_gained':
          this.deps.emit('player:lifeGained', { playerId: event.playerId, lives: event.lives });
          break;
        case 'player_eliminated':
          this.deps.emit('player:eliminated', { playerId: event.playerId });
          break;
        case 'game_finished':
          this.deps.emit('game:finished', { winnerId: event.winnerId });
          this.onGameFinished();
          break;
      }
    }
    this.syncExplosionTimer();
  }

  private syncExplosionTimer(): void {
    clearTimeout(this.explosionTimer);
    this.explosionTimer = undefined;
    if (!this.isPlaying) return;
    const delay = Math.max(0, this.game!.explodeAt - this.deps.now());
    this.explosionTimer = setTimeout(() => this.onExplosion(), delay);
  }

  private onExplosion(): void {
    if (!this.game) return;
    this.handleEngineEvents(this.game.explode());
    this.broadcast();
  }

  private onGameFinished(): void {
    const gone = [...this.members.values()].filter((m) => !m.connected).map((m) => m.id);
    for (const id of gone) this.removeMember(id);
  }

  private broadcast(): void {
    this.lastActivityAt = this.deps.now();
    this.deps.emit('room:state', this.snapshot());
  }
}
