import { expect, test } from 'vitest';
import { knownAs } from './aliases.js';

test('a club with aliases returns every normalised form, itself first', () => {
  expect(knownAs('Tottenham Hotspur')).toEqual(['tottenham hotspur', 'spurs', 'tottenham']);
});

test('the ledger is bidirectional — the nickname finds its formal self', () => {
  expect(knownAs('Spurs')).toContain('tottenham hotspur');
  expect(knownAs('Man City')).toContain('manchester city');
});

test("Nott'm Forest's apostrophe casualty normalises and resolves", () => {
  expect(knownAs("Nott'm Forest")).toContain('nottingham forest');
  expect(knownAs('Nottingham Forest')).toContain('nott m forest');
});

test('an unlisted club returns just its own normalised form', () => {
  expect(knownAs('Celtic')).toEqual(['celtic']);
  expect(knownAs('AFC Bournemouth')).toEqual(['afc bournemouth']);
});

test('null and empty stay empty', () => {
  expect(knownAs(null)).toEqual([]);
  expect(knownAs('')).toEqual([]);
});

test('the Scottish spoken forms are in the ledger', () => {
  expect(knownAs('Heart of Midlothian')).toContain('hearts');
  expect(knownAs('Hibernian')).toContain('hibs');
});
