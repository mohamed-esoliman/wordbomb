import type { MemberSnapshot } from '@wordbomb/shared';
import { Avatar } from './Avatar';
import { Button } from './ui';

interface MemberListProps {
  members: MemberSnapshot[];
  hostId: string;
  myId: string;
  maxPlayers: number;
  onToggleSeated: (seated: boolean) => void;
}

function Tag({
  children,
  tone = 'muted',
}: {
  children: string;
  tone?: 'muted' | 'accent' | 'danger';
}) {
  const tones = {
    muted: 'bg-surface-2 text-muted',
    accent: 'bg-accent/15 text-accent-soft',
    danger: 'bg-danger/15 text-danger',
  };
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function MemberList({ members, hostId, myId, maxPlayers, onToggleSeated }: MemberListProps) {
  const seated = members.filter((m) => m.connected && m.wantsToPlay).length;
  return (
    <div>
      <p className="mb-2 text-xs text-muted">
        {seated} of {maxPlayers} seats filled
      </p>
      <ul className="space-y-1.5">
        {members.map((m) => {
          const me = m.id === myId;
          return (
            <li
              key={m.id}
              className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${me ? 'bg-surface-2/70' : ''}`}
            >
              <span className="relative">
                <Avatar
                  id={m.avatar}
                  color={m.color}
                  size={36}
                  className={m.connected ? '' : 'opacity-40'}
                />
                <span
                  className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface ${
                    m.connected ? 'bg-success' : 'bg-muted'
                  }`}
                  aria-label={m.connected ? 'online' : 'offline'}
                />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
              <span className="flex flex-wrap items-center justify-end gap-1">
                {m.id === hostId && <Tag tone="accent">Host</Tag>}
                {me && <Tag>You</Tag>}
                {!m.wantsToPlay && <Tag>Sitting out</Tag>}
                {!m.connected && <Tag tone="danger">Offline</Tag>}
              </span>
              {me && (
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => onToggleSeated(!m.wantsToPlay)}
                >
                  {m.wantsToPlay ? 'Sit out' : 'Join in'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
