import { DEFAULT_SETTINGS, type GameSettings } from '@wordbomb/shared';
import { Game, type EngineDeps, type GameEvent } from './game.ts';

export interface Harness {
  game: Game;
  deps: EngineDeps;
  clock: { now: number };
  rngValues: number[];
  pickedRecents: string[][];
}

export interface HarnessOptions {
  players?: string[];
  settings?: Partial<GameSettings>;
  words?: string[];
  prompts?: string[];
  rng?: number[];
}

export function createHarness(options: HarnessOptions = {}): Harness {
  const clock = { now: 100_000 };
  const rngValues = options.rng ?? [0.5];
  let rngIndex = 0;
  const words = new Set(options.words ?? ['cat', 'cats', 'scat', 'dog', 'dogs', 'cog']);
  const prompts = options.prompts ?? [''];
  let promptIndex = 0;
  const pickedRecents: string[][] = [];

  const deps: EngineDeps = {
    rng: () => rngValues[rngIndex++ % rngValues.length]!,
    now: () => clock.now,
    dictionary: { has: (w) => words.has(w) },
    prompts: {
      pick: (_difficulty, recent) => {
        pickedRecents.push([...recent]);
        return prompts[promptIndex++ % prompts.length]!;
      },
    },
  };

  const settings = { ...DEFAULT_SETTINGS, ...options.settings };
  const game = new Game(settings, options.players ?? ['a', 'b', 'c'], deps);
  return { game, deps, clock, rngValues, pickedRecents };
}

export function types(events: GameEvent[]): string[] {
  return events.map((e) => e.type);
}
