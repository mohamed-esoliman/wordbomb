export interface FuseInput {
  now: number;
  bombLitAt: number;
  turnStartedAt: number;
  minTurnSeconds: number;
  bombMaxSeconds: number;
}

export interface FuseState {
  bombElapsedMs: number;
  turnElapsedMs: number;
  safe: boolean;
  intensity: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function fuseState(input: FuseInput): FuseState {
  const bombElapsedMs = Math.max(0, input.now - input.bombLitAt);
  const turnElapsedMs = Math.max(0, input.now - input.turnStartedAt);
  const safe = turnElapsedMs < input.minTurnSeconds * 1000;
  const intensity = clamp01(bombElapsedMs / (input.bombMaxSeconds * 1000));
  return { bombElapsedMs, turnElapsedMs, safe, intensity };
}

export class ServerClock {
  private offset = 0;

  sync(serverNow: number, localNow = Date.now()): void {
    this.offset = serverNow - localNow;
  }

  now(localNow = Date.now()): number {
    return localNow + this.offset;
  }
}
