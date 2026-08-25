import { expect, test } from 'vitest';
import {
  adaptFplIndex, adaptTsdbPlayers, adaptWikiSearch, adaptWikiSummary, fplPhotoUrl,
} from './dossier.js';

// Fixtures mirror the ledger's live-probed payload truths (2026-08-25):
// a standard Wikipedia REST summary, the disambiguation shape ("James
// Forrest" returns type: "disambiguation"), the proxy's TRIMMED FPL
// index, and TSDB's {"player":null} no-hits response.

const standardSummary = {
  title: 'James Forrest (footballer, born 1991)',
  type: 'standard',
  extract: 'James Forrest is a Scottish professional footballer who plays as a winger for Scottish Premiership club Celtic.',
  thumbnail: { source: 'https://upload.wikimedia.org/thumb/James_Forrest_2021.jpg/320px-James_Forrest_2021.jpg' },
  originalimage: { source: 'https://upload.wikimedia.org/James_Forrest_2021.jpg' },
};

const disambiguationSummary = {
  title: 'James Forrest',
  type: 'disambiguation',
  extract: 'James Forrest may refer to:',
};

// --- adaptWikiSummary ---

test('adaptWikiSummary shapes a standard summary: title, kind, extract, both image tiers', () => {
  expect(adaptWikiSummary(standardSummary)).toEqual({
    title: 'James Forrest (footballer, born 1991)',
    kind: 'standard',
    extract: 'James Forrest is a Scottish professional footballer who plays as a winger for Scottish Premiership club Celtic.',
    portrait: 'https://upload.wikimedia.org/thumb/James_Forrest_2021.jpg/320px-James_Forrest_2021.jpg',
    original: 'https://upload.wikimedia.org/James_Forrest_2021.jpg',
  });
});

test('adaptWikiSummary keeps the disambiguation kind (the ambiguity signal) with null images', () => {
  expect(adaptWikiSummary(disambiguationSummary)).toEqual({
    title: 'James Forrest',
    kind: 'disambiguation',
    extract: 'James Forrest may refer to:',
    portrait: null,
    original: null,
  });
});

test('adaptWikiSummary returns null on missing or malformed payloads, never throws', () => {
  expect(adaptWikiSummary(null)).toBeNull();
  expect(adaptWikiSummary(undefined)).toBeNull();
  expect(adaptWikiSummary('not an object')).toBeNull();
  expect(adaptWikiSummary({})).toBeNull(); // no title, no type
  expect(adaptWikiSummary({ title: 'X' })).toBeNull(); // no type
});

// --- adaptWikiSearch ---

test('adaptWikiSearch extracts the result titles in order', () => {
  const json = {
    query: {
      search: [
        { title: 'James Forrest (footballer, born 1991)', pageid: 1 },
        { title: 'James Forrest (footballer, born 1863)', pageid: 2 },
      ],
    },
  };
  expect(adaptWikiSearch(json)).toEqual([
    'James Forrest (footballer, born 1991)',
    'James Forrest (footballer, born 1863)',
  ]);
});

test('adaptWikiSearch is empty on malformed payloads and skips entries without a string title', () => {
  expect(adaptWikiSearch(null)).toEqual([]);
  expect(adaptWikiSearch({})).toEqual([]);
  expect(adaptWikiSearch({ query: {} })).toEqual([]);
  expect(adaptWikiSearch({ query: { search: [{ pageid: 3 }, { title: 'Kept' }] } })).toEqual(['Kept']);
});

// --- adaptFplIndex (the proxy already trimmed bootstrap-static) ---

const trimmedFpl = {
  teams: [{ id: 1, name: 'Arsenal' }, { id: 12, name: 'Liverpool' }],
  players: [
    { code: 223340, first: 'Bukayo', second: 'Saka', web: 'Saka', team: 1 },
    { code: 118748, first: 'Mohamed', second: 'Salah', web: 'M.Salah', team: 12 },
  ],
};

test('adaptFplIndex passes the trimmed proxy shape through after validating it', () => {
  expect(adaptFplIndex(trimmedFpl)).toEqual(trimmedFpl);
});

test('adaptFplIndex returns null when either array is missing or malformed', () => {
  expect(adaptFplIndex(null)).toBeNull();
  expect(adaptFplIndex({})).toBeNull();
  expect(adaptFplIndex({ teams: [], players: 'nope' })).toBeNull();
  expect(adaptFplIndex({ teams: 'nope', players: [] })).toBeNull();
});

// --- adaptTsdbPlayers ---

test('adaptTsdbPlayers maps player[] to name/team/cutout/thumb, nulling absent images', () => {
  const json = {
    player: [
      {
        strPlayer: 'James Forrest', strTeam: 'Celtic', strNumber: null,
        strCutout: 'https://r2.thesportsdb.com/images/media/player/cutout/abc.png',
        strThumb: 'https://r2.thesportsdb.com/images/media/player/thumb/def.jpg',
      },
      { strPlayer: 'James Forrest', strTeam: 'Retired Soccer', strCutout: null, strThumb: null },
    ],
  };
  expect(adaptTsdbPlayers(json)).toEqual([
    {
      name: 'James Forrest', team: 'Celtic',
      cutout: 'https://r2.thesportsdb.com/images/media/player/cutout/abc.png',
      thumb: 'https://r2.thesportsdb.com/images/media/player/thumb/def.jpg',
    },
    { name: 'James Forrest', team: 'Retired Soccer', cutout: null, thumb: null },
  ]);
});

test('adaptTsdbPlayers is empty on the live no-hits shape {"player":null} and on malformed payloads', () => {
  expect(adaptTsdbPlayers({ player: null })).toEqual([]); // TSDB's real no-hits response
  expect(adaptTsdbPlayers(null)).toEqual([]);
  expect(adaptTsdbPlayers({})).toEqual([]);
  expect(adaptTsdbPlayers({ player: 'nope' })).toEqual([]);
});

// --- fplPhotoUrl ---

test('fplPhotoUrl builds the keyless 110x140 headshot URL from a player code', () => {
  expect(fplPhotoUrl(223340))
    .toBe('https://resources.premierleague.com/premierleague/photos/players/110x140/p223340.png');
});
