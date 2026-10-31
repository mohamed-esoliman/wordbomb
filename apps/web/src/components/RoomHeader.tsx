import { useState } from 'react';
import type { RoomSnapshot } from '@wordbomb/shared';
import { SoundControls } from './SoundControls';
import { Button, Logo } from './ui';

interface RoomHeaderProps {
  room: RoomSnapshot;
  isHost: boolean;
  onLeave: () => void;
  onToggleVisibility?: () => void;
  children?: React.ReactNode;
}

export function RoomHeader({
  room,
  isHost,
  onLeave,
  onToggleVisibility,
  children,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this link', window.location.href);
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Logo />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{room.name}</p>
        <p className="text-xs text-muted">
          {room.visibility === 'public' ? 'Public room' : 'Private room'}
          {room.gamesPlayed > 0 ? ` · ${room.gamesPlayed} played` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={copyLink}
        className="rounded-xl border border-border bg-surface px-3 py-1.5 font-mono text-sm tracking-[0.2em] hover:border-accent"
        title="Copy invite link"
      >
        {copied ? 'Copied' : room.id}
      </button>
      {isHost && onToggleVisibility && (
        <Button variant="ghost" onClick={onToggleVisibility} className="px-3 py-1.5 text-xs">
          Make {room.visibility === 'public' ? 'private' : 'public'}
        </Button>
      )}
      {children}
      <SoundControls />
      <Button variant="ghost" onClick={onLeave} className="px-3 py-1.5 text-xs">
        Leave
      </Button>
    </header>
  );
}
