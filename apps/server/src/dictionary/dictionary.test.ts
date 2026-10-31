import { expect, test } from 'vitest';
import { createDictionary, loadDefaultDictionary, parseWordList } from './dictionary.ts';

test('parseWordList keeps only lowercase a-z entries', () => {
  const words = parseWordList('apple\n# comment\n  Banana \n\ncherry-pie\nd0g\nzebra\r\n');
  expect(words).toEqual(['apple', 'banana', 'zebra']);
});

test('createDictionary dedupes, normalizes and applies the blocklist', () => {
  const dict = createDictionary(['cat', 'Cat', 'dog', 'bad', 'ox'], ['BAD']);
  expect(dict.size).toBe(3);
  expect(dict.has('cat')).toBe(true);
  expect(dict.has('bad')).toBe(false);
  expect(dict.has('CAT')).toBe(false);
  expect(dict.words).toEqual(['cat', 'dog', 'ox']);
});

test('default dictionary loads the ENABLE list', () => {
  const dict = loadDefaultDictionary();
  expect(dict.size).toBeGreaterThan(170_000);
  expect(dict.has('bomb')).toBe(true);
  expect(dict.has('zymurgy')).toBe(true);
  expect(dict.has('xyzzy')).toBe(false);
  expect(dict.has('')).toBe(false);
});
