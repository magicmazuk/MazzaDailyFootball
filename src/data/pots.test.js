import { expect, test } from 'vitest';
import { potFor } from './pots.js';

// An injectable table (the shipped pots.json starts EMPTY each season
// until UEFA publishes — the ceremony must play unchipped until then).
const TABLE = {
  'uefa.champions': {
    season: '2026-27',
    pots: {
      1: ['Bayern Munich', 'Real Madrid'],
      2: ['Juventus', 'Atlético Madrid'],
      4: ['Kairat Almaty'],
    },
  },
};

const side = name => ({ teamId: 'x', name, shortName: name });

test('a curated club resolves to its pot number', () => {
  expect(potFor('uefa.champions', side('Bayern Munich'), TABLE)).toBe(1);
  expect(potFor('uefa.champions', side('Juventus'), TABLE)).toBe(2);
});

test('matching survives diacritics and case — the feed and the curation need not agree on accents', () => {
  expect(potFor('uefa.champions', side('Atletico Madrid'), TABLE)).toBe(2);
  expect(potFor('uefa.champions', side('BAYERN MUNICH'), TABLE)).toBe(1);
});

test('an uncurated club, comp, or empty table renders nothing — never a guess', () => {
  expect(potFor('uefa.champions', side('Celtic'), TABLE)).toBeNull();
  expect(potFor('uefa.europa', side('Bayern Munich'), TABLE)).toBeNull();
  expect(potFor('uefa.champions', side('Bayern Munich'), {})).toBeNull();
  expect(potFor('uefa.champions', null, TABLE)).toBeNull();
});

test('the shortName matches when the display name does not', () => {
  expect(potFor('uefa.champions',
    { teamId: 'x', name: 'FC Bayern München', shortName: 'Bayern Munich' }, TABLE)).toBe(1);
});

test('the shipped table starts empty — every lookup null until the season is curated', () => {
  expect(potFor('uefa.champions', side('Bayern Munich'))).toBeNull();
});
