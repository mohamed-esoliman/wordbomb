import type { Server, Socket } from 'socket.io';
import {
  ChatSendSchema,
  ERROR_MESSAGES,
  RoomCreateSchema,
  RoomJoinSchema,
  SetSeatedSchema,
  SetVisibilitySchema,
  SubmitWordSchema,
  TypingSchema,
  UpdateProfileSchema,
  UpdateSettingsSchema,
  type Ack,
  type ClientToServerEvents,
  type ErrorCode,
  type ServerToClientEvents,
} from '@wordbomb/shared';
import { RateLimiter } from './rateLimit.ts';
import type { Room } from './room.ts';
import type { RoomManager } from './roomManager.ts';

export interface SocketData {
  roomId?: string;
  memberId?: string;
}

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>;

export interface Limit {
  limit: number;
  windowMs: number;
}

export interface Limits {
  create: Limit;
  join: Limit;
  chat: Limit;
  typing: Limit;
}

export const DEFAULT_LIMITS: Limits = {
  create: { limit: 5, windowMs: 60_000 },
  join: { limit: 10, windowMs: 60_000 },
  chat: { limit: 1, windowMs: 1_000 },
  typing: { limit: 15, windowMs: 1_000 },
};

function clientIp(socket: IoSocket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || socket.handshake.address;
}

const errorPayload = (code: ErrorCode) => ({ code, message: ERROR_MESSAGES[code] });

export function registerSocketHandlers(
  io: IoServer,
  manager: RoomManager,
  limitOverrides: Partial<Limits> = {},
  limiter = new RateLimiter(),
): void {
  const LIMITS = { ...DEFAULT_LIMITS, ...limitOverrides };
  io.on('connection', (socket) => {
    const ip = clientIp(socket);
    const sendError = (code: ErrorCode) => socket.emit('room:error', errorPayload(code));
    const fail = <T>(code: ErrorCode): Ack<T> => ({ ok: false, error: errorPayload(code) });

    const current = (): { room: Room; memberId: string } | null => {
      const { roomId, memberId } = socket.data;
      if (!roomId || !memberId) return null;
      const room = manager.get(roomId);
      if (!room || !room.members.has(memberId)) return null;
      return { room, memberId };
    };

    const leaveCurrent = () => {
      const c = current();
      if (c) {
        c.room.leave(c.memberId);
        socket.leave(c.room.id);
        manager.removeIfEmpty(c.room.id);
      }
      socket.data.roomId = undefined;
      socket.data.memberId = undefined;
    };

    const enter = (
      room: Room,
      payload: { token: string; name: string; avatar: string },
    ): Ack<{ playerId: string }> => {
      const previousMemberId = socket.data.roomId === room.id ? socket.data.memberId : undefined;
      if (!previousMemberId) leaveCurrent();
      socket.join(room.id);
      const result = room.join({ ...payload, socketId: socket.id });
      if ('error' in result) {
        socket.leave(room.id);
        return fail(result.error);
      }
      if (previousMemberId && previousMemberId !== result.member.id) room.leave(previousMemberId);
      socket.data.roomId = room.id;
      socket.data.memberId = result.member.id;
      return { ok: true, playerId: result.member.id };
    };

    const withRoom = (fn: (room: Room, memberId: string) => ErrorCode | null | void) => {
      const c = current();
      if (!c) return sendError('not_in_room');
      const error = fn(c.room, c.memberId);
      if (error) sendError(error);
    };

    socket.on('room:create', (raw, ack) => {
      if (typeof ack !== 'function') return;
      const parsed = RoomCreateSchema.safeParse(raw);
      if (!parsed.success) return ack(fail('invalid_payload'));
      if (!limiter.allow(`create:${ip}`, LIMITS.create.limit, LIMITS.create.windowMs)) {
        return ack(fail('rate_limited'));
      }
      const room = manager.create(parsed.data.roomName ?? `${parsed.data.name}'s room`);
      if (!room) return ack(fail('too_many_rooms'));
      const result = enter(room, parsed.data);
      if (!result.ok) {
        manager.removeIfEmpty(room.id);
        return ack(result);
      }
      ack({ ok: true, roomId: room.id, playerId: result.playerId });
    });

    socket.on('room:join', (raw, ack) => {
      if (typeof ack !== 'function') return;
      const parsed = RoomJoinSchema.safeParse(raw);
      if (!parsed.success) return ack(fail('invalid_payload'));
      if (!limiter.allow(`join:${ip}`, LIMITS.join.limit, LIMITS.join.windowMs)) {
        return ack(fail('rate_limited'));
      }
      const room = manager.get(parsed.data.roomId);
      if (!room) return ack(fail('room_not_found'));
      ack(enter(room, parsed.data));
    });

    socket.on('room:leave', () => leaveCurrent());

    socket.on('room:updateSettings', (raw) => {
      const parsed = UpdateSettingsSchema.safeParse(raw);
      if (!parsed.success) return sendError('invalid_payload');
      withRoom((room, me) => room.updateSettings(me, parsed.data.settings));
    });

    socket.on('room:setVisibility', (raw) => {
      const parsed = SetVisibilitySchema.safeParse(raw);
      if (!parsed.success) return sendError('invalid_payload');
      withRoom((room, me) => room.setVisibility(me, parsed.data.visibility));
    });

    socket.on('member:updateProfile', (raw) => {
      const parsed = UpdateProfileSchema.safeParse(raw);
      if (!parsed.success) return sendError('invalid_payload');
      withRoom((room, me) => room.updateProfile(me, parsed.data.name, parsed.data.avatar));
    });

    socket.on('member:setSeated', (raw) => {
      const parsed = SetSeatedSchema.safeParse(raw);
      if (!parsed.success) return sendError('invalid_payload');
      withRoom((room, me) => room.setSeated(me, parsed.data.seated));
    });

    socket.on('game:start', () => {
      withRoom((room, me) => room.startGame(me));
    });

    socket.on('word:typing', (raw) => {
      const parsed = TypingSchema.safeParse(raw);
      if (!parsed.success) return;
      if (!limiter.allow(`typing:${socket.id}`, LIMITS.typing.limit, LIMITS.typing.windowMs))
        return;
      const c = current();
      c?.room.typing(c.memberId, parsed.data.text);
    });

    socket.on('word:submit', (raw, ack) => {
      if (typeof ack !== 'function') return;
      const parsed = SubmitWordSchema.safeParse(raw);
      if (!parsed.success) {
        sendError('invalid_payload');
        return ack({ accepted: false });
      }
      const c = current();
      if (!c) {
        sendError('not_in_room');
        return ack({ accepted: false });
      }
      ack(c.room.submitWord(c.memberId, parsed.data.word));
    });

    socket.on('chat:send', (raw) => {
      const parsed = ChatSendSchema.safeParse(raw);
      if (!parsed.success) return sendError('invalid_payload');
      if (!limiter.allow(`chat:${socket.id}`, LIMITS.chat.limit, LIMITS.chat.windowMs)) {
        return sendError('rate_limited');
      }
      withRoom((room, me) => {
        room.sendChat(me, parsed.data.text);
      });
    });

    socket.on('disconnect', () => {
      const c = current();
      c?.room.markDisconnected(c.memberId, socket.id);
      limiter.forget(`chat:${socket.id}`);
      limiter.forget(`typing:${socket.id}`);
    });
  });
}
