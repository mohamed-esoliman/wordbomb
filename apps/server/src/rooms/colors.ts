import { MEMBER_COLORS } from '@wordbomb/shared';

export function pickColor(inUse: Iterable<string>): string {
  const counts = new Map<string, number>(MEMBER_COLORS.map((c) => [c, 0]));
  for (const color of inUse) counts.set(color, (counts.get(color) ?? 0) + 1);
  let best: string = MEMBER_COLORS[0];
  let bestCount = Infinity;
  for (const color of MEMBER_COLORS) {
    const count = counts.get(color) ?? 0;
    if (count < bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}
