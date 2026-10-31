import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Dictionary {
  has(word: string): boolean;
  readonly size: number;
  readonly words: readonly string[];
}

const WORD_PATTERN = /^[a-z]+$/;

export function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase();
}

export function parseWordList(text: string): string[] {
  const words: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const word = normalizeWord(line);
    if (WORD_PATTERN.test(word)) words.push(word);
  }
  return words;
}

export function createDictionary(
  words: Iterable<string>,
  blocklist: Iterable<string> = [],
): Dictionary {
  const blocked = new Set<string>();
  for (const entry of blocklist) blocked.add(normalizeWord(entry));

  const set = new Set<string>();
  for (const raw of words) {
    const word = normalizeWord(raw);
    if (WORD_PATTERN.test(word) && !blocked.has(word)) set.add(word);
  }

  const list = [...set];
  return {
    has: (word) => set.has(word),
    size: set.size,
    words: list,
  };
}

export const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');

export function loadDictionaryFromFiles(wordsPath: string, blocklistPath?: string): Dictionary {
  const words = parseWordList(readFileSync(wordsPath, 'utf8'));
  const blocklist = blocklistPath ? parseWordList(readFileSync(blocklistPath, 'utf8')) : [];
  return createDictionary(words, blocklist);
}

export function loadDefaultDictionary(): Dictionary {
  return loadDictionaryFromFiles(
    path.join(DATA_DIR, 'enable1.txt'),
    path.join(DATA_DIR, 'blocklist.txt'),
  );
}
