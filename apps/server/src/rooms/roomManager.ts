import type { PublicRoomSummary, ServerToClientEvents } from '@wordbomb/shared';
import type { EngineDeps } from '../engine/game.ts';
import { generateRoomCode } from './codes.ts';
import { Room } from './room.ts';

export const ROOM_IDLE_MS = 5 * 60_000;
export const MAX_ROOMS = 200;

export type RoomEmit = <E extends keyof ServerToClientEvents>(
  roomId: string,
  event: E,
  payload: Parameters<ServerToClientEvents[E]>[0],
  volatile?: boolean,
) => void;

export interface RoomManagerDeps extends EngineDeps {
  emit: RoomEmit;
  maxRooms?: number;
  generateCode?: () => string;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private readonly deps: RoomManagerDeps;
  private readonly maxRooms: number;
  private readonly generateCode: () => string;
  private cleanupTimer: NodeJS.Timeout | undefined;

  constructor(deps: RoomManagerDeps) {
    this.deps = deps;
    this.maxRooms = deps.maxRooms ?? MAX_ROOMS;
    this.generateCode = deps.generateCode ?? generateRoomCode;
  }

  create(name: string): Room | null {
    if (this.rooms.size >= this.maxRooms) return null;
    let id = this.generateCode();
    while (this.rooms.has(id)) id = this.generateCode();
    const room = new Room(id, name, {
      ...this.deps,
      emit: (event, payload, volatile) => this.deps.emit(id, event, payload, volatile),
    });
    this.rooms.set(id, room);
    return room;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  listPublic(): PublicRoomSummary[] {
    return [...this.rooms.values()]
      .filter((room) => room.visibility === 'public' && room.hasConnectedMembers())
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .map((room) => room.summary());
  }

  delete(id: string): void {
    const room = this.rooms.get(id);
    if (!room) return;
    room.dispose();
    this.rooms.delete(id);
  }

  removeIfEmpty(id: string): boolean {
    const room = this.rooms.get(id);
    if (!room || !room.isEmpty) return false;
    this.delete(id);
    return true;
  }

  cleanup(): number {
    const now = this.deps.now();
    let removed = 0;
    for (const room of [...this.rooms.values()]) {
      const idle = !room.hasConnectedMembers() && now - room.lastActivityAt >= ROOM_IDLE_MS;
      if (room.isEmpty || idle) {
        this.delete(room.id);
        removed++;
      }
    }
    return removed;
  }

  startCleanup(intervalMs: number): void {
    this.stop();
    this.cleanupTimer = setInterval(() => this.cleanup(), intervalMs);
    this.cleanupTimer.unref();
  }

  stop(): void {
    clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
    for (const room of this.rooms.values()) room.dispose();
  }
}
