import { useEffect } from 'react';
import type { MemberSnapshot } from '@wordbomb/shared';
import { Avatar } from './Avatar';
import { Button } from './ui';

const AUTO_DISMISS_MS = 6000;

export function WinnerOverlay({
  winner,
  me,
  onDismiss,
}: {
  winner: MemberSnapshot | undefined;
  me: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-8 text-center shadow-2xl">
        {winner ? (
          <>
            <Avatar id={winner.avatar} color={winner.color} size={96} />
            <p className="text-sm font-semibold tracking-widest text-muted uppercase">Winner</p>
            <p className="font-display text-4xl font-extrabold">{me ? 'You win!' : winner.name}</p>
          </>
        ) : (
          <p className="font-display text-3xl font-extrabold">Game over</p>
        )}
        <Button variant="secondary" onClick={onDismiss}>
          Back to lobby
        </Button>
      </div>
    </div>
  );
}
