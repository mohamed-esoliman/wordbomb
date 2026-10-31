import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@wordbomb/shared';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): ClientSocket {
  return io({ autoConnect: false, reconnectionDelay: 500, reconnectionDelayMax: 4000 });
}
