import type { ReactNode } from 'react';

interface PlayerRingProps {
  count: number;
  children: ReactNode[];
  center: ReactNode;
}

const RADIUS = 250;

export function PlayerRing({ count, children, center }: PlayerRingProps) {
  return (
    <>
      <div className="flex flex-col items-center gap-6 md:hidden">
        <div className="flex flex-wrap justify-center gap-3 pt-7">{children}</div>
        {center}
      </div>
      <div
        className="relative mx-auto hidden md:block"
        style={{ width: RADIUS * 2 + 140, height: RADIUS * 2 + 120 }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">{center}</div>
        {children.map((child, i) => {
          const angle = -Math.PI / 2 + (i / Math.max(count, 1)) * Math.PI * 2;
          const x = Math.cos(angle) * RADIUS;
          const y = Math.sin(angle) * RADIUS;
          return (
            <div
              key={i}
              className="absolute top-1/2 left-1/2"
              style={{
                transform: `translate(calc(-50% + ${x.toFixed(0)}px), calc(-50% + ${y.toFixed(0)}px))`,
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    </>
  );
}
