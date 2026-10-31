import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import type { MemberSnapshot, SeatSnapshot } from '@wordbomb/shared';
import { Avatar } from './Avatar';

export type Flash = 'accept' | 'hit' | 'gain' | 'out';

interface PlayerCardProps {
  member: MemberSnapshot | undefined;
  seat: SeatSnapshot;
  active: boolean;
  me: boolean;
  typing: string;
  maxLives: number;
  flash?: { kind: Flash; at: number };
  className?: string;
}

const flashRing: Record<Flash, string> = {
  accept: 'ring-2 ring-success',
  hit: 'ring-2 ring-danger',
  gain: 'ring-2 ring-accent-soft',
  out: '',
};

export function PlayerCard({
  member,
  seat,
  active,
  me,
  typing,
  maxLives,
  flash,
  className = '',
}: PlayerCardProps) {
  const reduced = useReducedMotion();
  const name = member?.name ?? 'Left';
  const offline = member ? !member.connected : true;
  const animate =
    reduced || !flash
      ? {}
      : flash.kind === 'hit'
        ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
        : flash.kind === 'accept' || flash.kind === 'gain'
          ? { scale: [1, 1.08, 1] }
          : {};

  return (
    <m.div
      key={flash?.at}
      animate={animate}
      transition={{ duration: 0.45 }}
      className={`relative flex w-28 flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-center transition-colors ${
        seat.eliminated
          ? 'border-transparent opacity-35 grayscale'
          : active
            ? 'border-accent bg-accent/10 shadow-[0_0_30px_rgba(249,115,22,0.35)]'
            : 'border-border bg-surface/80'
      } ${flash && !seat.eliminated ? flashRing[flash.kind] : ''} ${className}`}
      data-active={active}
      data-player={seat.playerId}
    >
      {typing && !seat.eliminated && (
        <span className="absolute -top-7 left-1/2 max-w-40 -translate-x-1/2 truncate rounded-lg bg-surface-2 px-2 py-0.5 font-mono text-xs text-text shadow">
          {typing}
        </span>
      )}
      <Avatar id={member?.avatar ?? 'circle-happy'} color={member?.color ?? '#555'} size={44} />
      <span className="w-full truncate text-sm font-semibold">
        {name}
        {me ? ' (you)' : ''}
      </span>
      <span className="flex gap-0.5" aria-label={`${seat.lives} lives`}>
        {Array.from({ length: maxLives }, (_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${i < seat.lives ? 'bg-danger' : 'bg-border'}`}
          />
        ))}
      </span>
      {offline && !seat.eliminated && <span className="text-[10px] text-muted">offline</span>}
      {seat.eliminated && <span className="text-[10px] text-muted">out</span>}
    </m.div>
  );
}
