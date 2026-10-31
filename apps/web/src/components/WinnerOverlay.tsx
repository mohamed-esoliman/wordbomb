import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import * as m from 'motion/react-m';
import type { MemberSnapshot } from '@wordbomb/shared';
import { prefersReducedMotion } from '../lib/motion';
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

  useEffect(() => {
    if (!winner || prefersReducedMotion()) return;
    const colors = ['#f97316', '#fdba74', '#8b5cf6', '#22c55e', winner.color];
    const burst = (x: number, angle: number) =>
      confetti({
        particleCount: 90,
        spread: 70,
        startVelocity: 45,
        origin: { x, y: 0.7 },
        angle,
        colors,
      });
    burst(0.15, 60);
    burst(0.85, 120);
    const timer = setTimeout(
      () => confetti({ particleCount: 140, spread: 110, origin: { y: 0.4 }, colors }),
      500,
    );
    return () => {
      clearTimeout(timer);
      confetti.reset();
    };
  }, [winner]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <m.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-8 text-center shadow-2xl"
      >
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
      </m.div>
    </div>
  );
}
