export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  allow(key: string, limit: number, windowMs: number): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  forget(prefix: string): void {
    for (const key of this.hits.keys()) {
      if (key.startsWith(prefix)) this.hits.delete(key);
    }
  }

  prune(maxAgeMs: number): void {
    const now = this.now();
    for (const [key, times] of this.hits) {
      const recent = times.filter((t) => now - t < maxAgeMs);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }
}
