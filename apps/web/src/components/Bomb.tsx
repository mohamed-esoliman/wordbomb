import { useSyncExternalStore } from 'react';
import type { GameSettings, GameSnapshot } from '@wordbomb/shared';
import { fuseState, type FuseState } from '../lib/clock';
import type { ServerClock } from '../lib/clock';

let frameCount = 0;

function subscribeFrames(onChange: () => void): () => void {
  let frame = requestAnimationFrame(function loop() {
    frameCount++;
    onChange();
    frame = requestAnimationFrame(loop);
  });
  return () => cancelAnimationFrame(frame);
}

export function useAnimationFrame(): number {
  return useSyncExternalStore(
    subscribeFrames,
    () => frameCount,
    () => 0,
  );
}

export function useFuse(game: GameSnapshot, settings: GameSettings, clock: ServerClock): FuseState {
  useAnimationFrame();
  return fuseState({
    now: clock.now(),
    bombLitAt: game.bombLitAt,
    turnStartedAt: game.turnStartedAt,
    minTurnSeconds: settings.minTurnSeconds,
    bombMaxSeconds: settings.bombMaxSeconds,
  });
}

export function Bomb({ prompt, fuse }: { prompt: string; fuse: FuseState }) {
  const heat = fuse.safe ? 0 : fuse.intensity;
  return (
    <div
      className="relative flex h-52 w-52 items-center justify-center rounded-full border-4 border-border bg-surface-2 shadow-2xl"
      style={{ boxShadow: `0 0 ${20 + heat * 60}px rgba(249,115,22,${0.2 + heat * 0.6})` }}
    >
      <span className="font-display text-5xl font-extrabold tracking-[0.2em] uppercase">
        {prompt}
      </span>
      <span
        className="absolute inset-x-6 bottom-6 h-1.5 overflow-hidden rounded-full bg-border"
        aria-hidden="true"
      >
        <span
          className="block h-full bg-accent"
          style={{ width: `${(1 - fuse.intensity) * 100}%` }}
        />
      </span>
    </div>
  );
}
