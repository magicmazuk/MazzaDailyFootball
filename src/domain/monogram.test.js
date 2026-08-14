import { monogram } from './monogram.js';

test('two-word clubs take both initials', () => {
  expect(monogram('Auchinleck Talbot')).toBe('AT');
  expect(monogram('Wick Academy')).toBe('WA');
});

test("apostrophes don't break the second word", () => {
  expect(monogram("Banks O'Dee")).toBe('BO');
});

test('single-word clubs take the first two letters', () => {
  expect(monogram('Celtic')).toBe('CE');
});

test('empty input degrades to a question mark', () => {
  expect(monogram('')).toBe('?');
});
