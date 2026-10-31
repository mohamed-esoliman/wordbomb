import { useSyncExternalStore } from 'react';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
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

interface BombProps {
  prompt: string;
  fuse: FuseState;
  explosion: number;
}

export function Bomb({ prompt, fuse, explosion }: BombProps) {
  const reduced = useReducedMotion();
  const heat = fuse.safe ? fuse.intensity * 0.3 : fuse.intensity;
  const jitter = reduced ? 0 : heat * heat * 7;
  const phase = fuse.bombElapsedMs;
  const dx = Math.sin(phase * 0.37) * jitter;
  const dy = Math.cos(phase * 0.53) * jitter;
  const fuseLength = 1 - fuse.intensity;

  return (
    <div className="relative flex h-60 w-60 items-center justify-center">
      <AnimatePresence>
        {explosion > 0 && (
          <m.div
            key={explosion}
            className="pointer-events-none absolute inset-0 rounded-full bg-accent-soft"
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: reduced ? 1.2 : 3.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <div
        className="relative h-full w-full"
        style={{
          transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`,
          filter: `drop-shadow(0 0 ${12 + heat * 36}px rgba(249,115,22,${0.25 + heat * 0.6}))`,
        }}
      >
        <svg viewBox="0 0 240 240" className="h-full w-full" aria-hidden="true">
          <defs>
            <radialGradient id="bombBody" cx="38%" cy="32%" r="70%">
              <stop offset="0%" stopColor="#5b6587" />
              <stop offset="55%" stopColor="#2a3250" />
              <stop offset="100%" stopColor="#141827" />
            </radialGradient>
          </defs>
          <rect
            x="148"
            y="34"
            width="30"
            height="26"
            rx="6"
            fill="#2b3350"
            transform="rotate(35 163 47)"
          />
          <path
            d="M170 40 C 190 20, 215 30, 222 18"
            fill="none"
            stroke="#c9a27a"
            strokeWidth="6"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - Math.max(0.08, fuseLength)}
          />
          <circle cx="120" cy="130" r="92" fill="url(#bombBody)" stroke="#3a4466" strokeWidth="4" />
          <ellipse
            cx="88"
            cy="96"
            rx="22"
            ry="12"
            fill="#ffffff"
            opacity="0.08"
            transform="rotate(-30 88 96)"
          />
          <g
            transform={`translate(${222 - (1 - Math.max(0.08, fuseLength)) * 52} ${18 + (1 - Math.max(0.08, fuseLength)) * 22})`}
          >
            <circle r={7 + heat * 4} fill="#fde68a" opacity="0.95">
              {!reduced && (
                <animate
                  attributeName="r"
                  values="6;10;6"
                  dur={`${0.5 - heat * 0.3}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
            <circle r={3} fill="#ffffff" />
          </g>
          <text
            data-testid="prompt"
            x="120"
            y="146"
            textAnchor="middle"
            fontSize={prompt.length > 2 ? 54 : 64}
            fontWeight="800"
            fill="#f8fafc"
            letterSpacing="6"
            style={{ textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}
          >
            {prompt.toUpperCase()}
          </text>
        </svg>
      </div>
    </div>
  );
}
