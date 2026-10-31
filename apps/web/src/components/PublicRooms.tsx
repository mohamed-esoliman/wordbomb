import { useEffect, useState } from 'react';
import type { PublicRoomSummary } from '@wordbomb/shared';
import { Button } from './ui';

const POLL_MS = 5000;

export function usePublicRooms(enabled = true): PublicRoomSummary[] {
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (!res.ok) return;
        const data = (await res.json()) as PublicRoomSummary[];
        if (!cancelled) setRooms(data);
      } catch {
        // offline or server restarting; keep the previous list
      }
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);
  return rooms;
}

export function PublicRooms({
  onJoin,
  disabled,
}: {
  onJoin: (id: string) => void;
  disabled: boolean;
}) {
  const rooms = usePublicRooms();
  if (rooms.length === 0) {
    return (
      <p className="text-sm text-muted">
        No public rooms right now. Create one and make it public.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {rooms.map((room) => (
        <li key={room.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-medium">{room.name}</p>
            <p className="text-xs text-muted">
              {room.players}/{room.maxPlayers} players
              {room.status === 'playing' ? ' · in game' : ' · waiting'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => onJoin(room.id)} disabled={disabled}>
            Join
          </Button>
        </li>
      ))}
    </ul>
  );
}
