import { z } from 'zod';
import { AVATAR_IDS } from './avatars.ts';
import type { GameSnapshot, RejectReason } from './game.ts';
import { GameSettingsSchema, type GameSettings } from './settings.ts';

export const MAX_NAME_LENGTH = 16;
export const MAX_ROOM_NAME_LENGTH = 24;
export const MAX_CHAT_LENGTH = 200;
export const MAX_TYPING_LENGTH = 40;
export const CHAT_HISTORY_LIMIT = 50;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_ROOM_MEMBERS = 12;

export const NameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_NAME_LENGTH)
  .regex(/^[\p{L}\p{N} _\-.']+$/u, "Only letters, numbers, spaces and _ - . ' are allowed");

export const RoomNameSchema = z.string().trim().min(1).max(MAX_ROOM_NAME_LENGTH);

export const TokenSchema = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const RoomCodeSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(
    z
      .string()
      .length(ROOM_CODE_LENGTH)
      .regex(/^[A-Z2-9]+$/),
  );

export const AvatarSchema = z.enum(AVATAR_IDS as [string, ...string[]]);

export const VisibilitySchema = z.enum(['public', 'private']);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const RoomCreateSchema = z.object({
  name: NameSchema,
  avatar: AvatarSchema,
  token: TokenSchema,
  roomName: RoomNameSchema.optional(),
});
export type RoomCreatePayload = z.input<typeof RoomCreateSchema>;

export const RoomJoinSchema = z.object({
  roomId: RoomCodeSchema,
  name: NameSchema,
  avatar: AvatarSchema,
  token: TokenSchema,
});
export type RoomJoinPayload = z.input<typeof RoomJoinSchema>;

export const UpdateSettingsSchema = z.object({ settings: GameSettingsSchema });
export const SetVisibilitySchema = z.object({ visibility: VisibilitySchema });
export const UpdateProfileSchema = z.object({ name: NameSchema, avatar: AvatarSchema });
export const SetSeatedSchema = z.object({ seated: z.boolean() });
export const TypingSchema = z.object({ text: z.string().max(MAX_TYPING_LENGTH) });
export const SubmitWordSchema = z.object({ word: z.string().max(60) });
export const ChatSendSchema = z.object({ text: z.string().trim().min(1).max(MAX_CHAT_LENGTH) });

export const ERROR_CODES = [
  'invalid_payload',
  'room_not_found',
  'room_full',
  'too_many_rooms',
  'not_in_room',
  'not_host',
  'game_in_progress',
  'not_enough_players',
  'rate_limited',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  invalid_payload: 'Invalid request',
  room_not_found: 'Room not found',
  room_full: 'Room is full',
  too_many_rooms: 'Too many rooms right now, try again later',
  not_in_room: 'You are not in a room',
  not_host: 'Only the host can do that',
  game_in_progress: 'Not available while a game is running',
  not_enough_players: 'Need at least 2 players to start',
  rate_limited: 'Slow down',
};

export type Ack<T> = ({ ok: true } & T) | { ok: false; error: ErrorPayload };

export interface MemberSnapshot {
  id: string;
  name: string;
  avatar: string;
  color: string;
  connected: boolean;
  wantsToPlay: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
}

export interface RoomSnapshot {
  id: string;
  name: string;
  hostId: string;
  visibility: Visibility;
  settings: GameSettings;
  members: MemberSnapshot[];
  chat: ChatMessage[];
  game: GameSnapshot | null;
  gamesPlayed: number;
  serverNow: number;
}

export interface PublicRoomSummary {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  status: 'waiting' | 'playing';
}

export interface ClientToServerEvents {
  'room:create': (
    payload: RoomCreatePayload,
    ack: (reply: Ack<{ roomId: string }>) => void,
  ) => void;
  'room:join': (payload: RoomJoinPayload, ack: (reply: Ack<{ playerId: string }>) => void) => void;
  'room:leave': () => void;
  'room:updateSettings': (payload: { settings: GameSettings }) => void;
  'room:setVisibility': (payload: { visibility: Visibility }) => void;
  'member:updateProfile': (payload: { name: string; avatar: string }) => void;
  'member:setSeated': (payload: { seated: boolean }) => void;
  'game:start': () => void;
  'word:typing': (payload: { text: string }) => void;
  'word:submit': (
    payload: { word: string },
    ack: (reply: { accepted: boolean; reason?: RejectReason }) => void,
  ) => void;
  'chat:send': (payload: { text: string }) => void;
}

export interface ServerToClientEvents {
  'room:state': (snapshot: RoomSnapshot) => void;
  'room:error': (error: ErrorPayload) => void;
  'word:typing': (payload: { playerId: string; text: string }) => void;
  'word:accepted': (payload: { playerId: string; word: string; newLetters: string[] }) => void;
  'word:rejected': (payload: { playerId: string; word: string; reason: RejectReason }) => void;
  'bomb:exploded': (payload: { playerId: string; livesLeft: number }) => void;
  'player:lifeGained': (payload: { playerId: string; lives: number }) => void;
  'player:eliminated': (payload: { playerId: string }) => void;
  'game:finished': (payload: { winnerId: string | null }) => void;
  'chat:message': (message: ChatMessage) => void;
}
