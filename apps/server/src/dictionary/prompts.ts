import { PROMPT_DIFFICULTIES, type PromptDifficulty } from '@wordbomb/shared';

export const PROMPT_LENGTHS = [2, 3];

export const DIFFICULTY_MIN_WORDS: Record<PromptDifficulty, number> = {
  easy: 500,
  medium: 100,
  hard: 20,
};

export type PromptIndex = Map<string, number>;

export function buildPromptIndex(words: Iterable<string>, lengths = PROMPT_LENGTHS): PromptIndex {
  const counts: PromptIndex = new Map();
  for (const word of words) {
    const seen = new Set<string>();
    for (const len of lengths) {
      for (let i = 0; i + len <= word.length; i++) seen.add(word.slice(i, i + len));
    }
    for (const prompt of seen) counts.set(prompt, (counts.get(prompt) ?? 0) + 1);
  }
  return counts;
}

export interface PromptPicker {
  pick(difficulty: PromptDifficulty, recent: readonly string[], rng: () => number): string;
  poolSize(difficulty: PromptDifficulty): number;
}

export function createPromptPicker(
  index: PromptIndex,
  minWords: Record<PromptDifficulty, number> = DIFFICULTY_MIN_WORDS,
): PromptPicker {
  const sorted = [...index.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  const pools = {} as Record<PromptDifficulty, string[]>;
  for (const difficulty of PROMPT_DIFFICULTIES) {
    pools[difficulty] = sorted
      .filter(([, count]) => count >= minWords[difficulty])
      .map(([prompt]) => prompt);
  }

  return {
    pick(difficulty, recent, rng) {
      const pool = pools[difficulty];
      if (pool.length === 0) throw new Error(`no prompts available for difficulty ${difficulty}`);
      const recentSet = new Set(recent);
      const candidates = pool.filter((p) => !recentSet.has(p));
      const source = candidates.length > 0 ? candidates : pool;
      return source[Math.min(source.length - 1, Math.floor(rng() * source.length))]!;
    },
    poolSize: (difficulty) => pools[difficulty].length,
  };
}
