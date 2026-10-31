import { expect, test } from 'vitest';
import { loadDefaultDictionary } from './dictionary.ts';
import { buildPromptIndex, createPromptPicker, DIFFICULTY_MIN_WORDS } from './prompts.ts';

const fixture = ['cat', 'cats', 'scat', 'dog', 'dogs', 'cog'];
const thresholds = { easy: 3, medium: 2, hard: 1 };

test('buildPromptIndex counts words containing each substring once', () => {
  const index = buildPromptIndex(fixture);
  expect(index.get('ca')).toBe(3);
  expect(index.get('cat')).toBe(3);
  expect(index.get('og')).toBe(3);
  expect(index.get('at')).toBe(3);
  expect(index.get('ts')).toBe(1);
  expect(index.get('dogs')).toBeUndefined();
  expect(index.get('d')).toBeUndefined();
});

test('buildPromptIndex counts a repeated substring in one word once', () => {
  const index = buildPromptIndex(['banana']);
  expect(index.get('an')).toBe(1);
  expect(index.get('ana')).toBe(1);
});

test('pools respect difficulty thresholds', () => {
  const picker = createPromptPicker(buildPromptIndex(fixture), thresholds);
  expect(picker.poolSize('easy')).toBeLessThanOrEqual(picker.poolSize('medium'));
  expect(picker.poolSize('medium')).toBeLessThanOrEqual(picker.poolSize('hard'));
  const picked = picker.pick('easy', [], () => 0);
  expect(['at', 'ca', 'cat', 'og']).toContain(picked);
});

test('pick avoids recent prompts and is driven by rng', () => {
  const picker = createPromptPicker(buildPromptIndex(fixture), thresholds);
  const first = picker.pick('easy', [], () => 0);
  const second = picker.pick('easy', [first], () => 0);
  expect(second).not.toBe(first);
  const last = picker.pick('easy', [], () => 0.999);
  expect(last).not.toBe(first);
});

test('pick falls back to the full pool when everything is recent', () => {
  const picker = createPromptPicker(buildPromptIndex(fixture), thresholds);
  const all = Array.from({ length: picker.poolSize('easy') }, (_, i) =>
    picker.pick('easy', [], () => i / picker.poolSize('easy')),
  );
  const picked = picker.pick('easy', all, () => 0.5);
  expect(all).toContain(picked);
});

test('pick throws when a pool is empty', () => {
  const picker = createPromptPicker(buildPromptIndex(['ab']), { easy: 5, medium: 5, hard: 5 });
  expect(() => picker.pick('hard', [], () => 0)).toThrow(/no prompts/);
});

test('real dictionary yields sizeable pools at every difficulty', () => {
  const dict = loadDefaultDictionary();
  const index = buildPromptIndex(dict.words);
  const picker = createPromptPicker(index);
  expect(index.get('ing')).toBeGreaterThan(5000);
  expect(picker.poolSize('easy')).toBeGreaterThan(200);
  expect(picker.poolSize('hard')).toBeGreaterThan(picker.poolSize('easy'));
  const prompt = picker.pick('medium', [], Math.random);
  expect(index.get(prompt)).toBeGreaterThanOrEqual(DIFFICULTY_MIN_WORDS.medium);
  expect(dict.words.filter((w) => w.includes(prompt)).length).toBe(index.get(prompt));
});
