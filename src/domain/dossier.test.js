import { expect, test } from 'vitest';
import {
  creditFor, faceFor, fplFace, fplTeamId, normalise, pickSearchTitle, searchQuery,
  tsdbFace, verifiedSummary,
} from './dossier.js';

// The law (spec §13.37): never show an unverified identity. Every function
// here errs toward null — a wrong face on the right name is worse than no
// face at all.

// --- fixtures: the probe truths, as the spike found them ---------------------

// Wikipedia summary, adapted shape (Task 1's adapter).
const forrest = {
  title: 'James Forrest (footballer, born 1991)',
  kind: 'standard',
  extract: 'James Forrest is a Scottish professional footballer who plays as '
    + 'a winger for Scottish Premiership club Celtic and the Scotland '
    + 'national team.',
  portrait: 'https://upload.wikimedia.org/thumb/forrest.jpg',
  original: 'https://upload.wikimedia.org/forrest.jpg',
};

// FPL bootstrap index, trimmed shape.
const fplIndex = {
  teams: [
    { id: 1, name: 'Manchester City' },
    { id: 2, name: 'Manchester United' },
    { id: 3, name: 'Newcastle' },
    { id: 4, name: 'Liverpool' },
    { id: 5, name: 'Brentford' },
  ],
  players: [
    { code: 223094, first: 'Erling', second: 'Haaland', web: 'Haaland', team: 1 },
    { code: 141746, first: 'Bruno', second: 'Fernandes', web: 'B.Fernandes', team: 2 },
    { code: 232826, first: 'Anthony', second: 'Gordon', web: 'Gordon', team: 3 },
    { code: 98747, first: 'Nicholas', second: 'Pope', web: 'Pope', team: 3 },
    { code: 111111, first: 'Kevin', second: 'Schade', web: 'Schade', team: 5 },
    { code: 222222, first: 'Fin', second: 'Schade', web: 'Schade', team: 5 },
  ],
};

// --- normalise: the house form ----------------------------------------------

test('normalise: lowercase, diacritics folded, punctuation to spaces, collapsed', () => {
  expect(normalise('Cláudio Braga')).toBe('claudio braga');
  expect(normalise('Celtic F.C.')).toBe('celtic f c');
  expect(normalise('  Saint-Étienne  ')).toBe('saint etienne');
});

test('normalise: null and undefined give the empty string', () => {
  expect(normalise(null)).toBe('');
  expect(normalise(undefined)).toBe('');
});

// --- verifiedSummary: the extract must name the man AND his club ------------

test('verifiedSummary: a standard summary naming surname and club passes unchanged', () => {
  expect(verifiedSummary(forrest, { name: 'James Forrest', club: 'Celtic' }))
    .toBe(forrest);
});

test('verifiedSummary: the James Forrest disambiguation page is refused', () => {
  const disambig = {
    ...forrest,
    title: 'James Forrest',
    kind: 'disambiguation',
    extract: 'James Forrest may refer to:',
  };
  expect(verifiedSummary(disambig, { name: 'James Forrest', club: 'Celtic' }))
    .toBe(null);
});

test('verifiedSummary: an extract naming the WRONG club is refused', () => {
  const rangersMan = {
    ...forrest,
    extract: 'James Forrest is a footballer who plays for Rangers.',
  };
  expect(verifiedSummary(rangersMan, { name: 'James Forrest', club: 'Celtic' }))
    .toBe(null);
});

test('verifiedSummary: a Manchester City extract never verifies a Manchester United player', () => {
  const cityMan = {
    ...forrest,
    extract: 'Bruno Fernandes is a midfielder who plays for Manchester City.',
  };
  expect(verifiedSummary(cityMan, { name: 'Bruno Fernandes', club: 'Manchester United' }))
    .toBe(null);
  const unitedMan = {
    ...cityMan,
    extract: 'Bruno Fernandes is a midfielder who plays for Manchester United.',
  };
  expect(verifiedSummary(unitedMan, { name: 'Bruno Fernandes', club: 'Manchester United' }))
    .toBe(unitedMan);
});

test('verifiedSummary: generic club designators strip — F.C., AFC, Football Club', () => {
  // ESPN may carry the suffixed name; prose says plain 'Celtic'.
  expect(verifiedSummary(forrest, { name: 'James Forrest', club: 'Celtic F.C.' }))
    .toBe(forrest);
  const cherries = {
    ...forrest,
    extract: 'Antoine Semenyo is a forward who plays for Premier League club '
      + 'Bournemouth.',
  };
  expect(verifiedSummary(cherries, { name: 'Antoine Semenyo', club: 'AFC Bournemouth' }))
    .toBe(cherries);
  const bellshill = {
    ...forrest,
    extract: 'John Smith plays junior football for Bellshill.',
  };
  expect(verifiedSummary(bellshill, { name: 'John Smith', club: 'Bellshill Football Club' }))
    .toBe(bellshill);
});

test('verifiedSummary: "City" is NOT generic here — Manchester City must match as a phrase', () => {
  const cityMan = {
    ...forrest,
    extract: 'Erling Haaland is a striker who plays for Manchester City.',
  };
  expect(verifiedSummary(cityMan, { name: 'Erling Haaland', club: 'Manchester City' }))
    .toBe(cityMan);
  // 'Manchester' alone in prose is not the phrase 'manchester city'.
  const vague = {
    ...forrest,
    extract: 'Erling Haaland is a striker based in Manchester.',
  };
  expect(verifiedSummary(vague, { name: 'Erling Haaland', club: 'Manchester City' }))
    .toBe(null);
});

test('verifiedSummary: a club stripping to nothing falls back to its full normalised name', () => {
  const initials = {
    ...forrest,
    extract: 'Jamie Doe signed for AFC in the summer.',
  };
  expect(verifiedSummary(initials, { name: 'Jamie Doe', club: 'AFC' })).toBe(initials);
  const absent = { ...forrest, extract: 'Jamie Doe is a free agent.' };
  expect(verifiedSummary(absent, { name: 'Jamie Doe', club: 'AFC' })).toBe(null);
});

test('verifiedSummary: accented names verify against unaccented prose', () => {
  const braga = {
    ...forrest,
    extract: 'Claudio Braga is a Norwegian-based forward who plays for '
      + 'Scottish club Aberdeen.',
  };
  expect(verifiedSummary(braga, { name: 'Cláudio Braga', club: 'Aberdeen' }))
    .toBe(braga);
});

test('verifiedSummary: surname matches whole words only — no hiding inside longer words', () => {
  const wolves = {
    ...forrest,
    extract: 'Wolverhampton signed a defender from Celtic.',
  };
  expect(verifiedSummary(wolves, { name: 'Joe Ham', club: 'Celtic' })).toBe(null);
});

test('verifiedSummary: an extract naming the club but not the surname is refused', () => {
  const clubOnly = {
    ...forrest,
    extract: 'Celtic are a football club based in Glasgow.',
  };
  expect(verifiedSummary(clubOnly, { name: 'James Forrest', club: 'Celtic' }))
    .toBe(null);
});

test('verifiedSummary: null or missing anything gives null, never a throw', () => {
  expect(verifiedSummary(null, { name: 'James Forrest', club: 'Celtic' })).toBe(null);
  expect(verifiedSummary(forrest, { name: null, club: 'Celtic' })).toBe(null);
  expect(verifiedSummary(forrest, { name: 'James Forrest', club: null })).toBe(null);
  expect(verifiedSummary(forrest, null)).toBe(null);
  expect(verifiedSummary({ ...forrest, extract: null },
    { name: 'James Forrest', club: 'Celtic' })).toBe(null);
});

// --- searchQuery: the disambiguation fallback query -------------------------

test('searchQuery: name, the word footballer, then the club', () => {
  expect(searchQuery('James Forrest', 'Celtic')).toBe('James Forrest footballer Celtic');
});

test('searchQuery: club omitted cleanly when null; no name, no query', () => {
  expect(searchQuery('James Forrest', null)).toBe('James Forrest footballer');
  expect(searchQuery(null, 'Celtic')).toBe(null);
});

// --- pickSearchTitle: the first title carrying the surname ------------------

test('pickSearchTitle: the first title with the surname as a whole word wins', () => {
  const titles = [
    'Celtic F.C.',
    'James Forrest (footballer, born 1991)',
    'James Forrest (rugby union)',
  ];
  expect(pickSearchTitle(titles, 'James Forrest'))
    .toBe('James Forrest (footballer, born 1991)');
});

test('pickSearchTitle: whole words only — Forrestfield does not carry Forrest', () => {
  expect(pickSearchTitle(['Forrestfield railway station'], 'James Forrest')).toBe(null);
});

test('pickSearchTitle: no carrying title, or null inputs, give null', () => {
  expect(pickSearchTitle(['Celtic F.C.', 'Celtic Park'], 'James Forrest')).toBe(null);
  expect(pickSearchTitle([], 'James Forrest')).toBe(null);
  expect(pickSearchTitle(null, 'James Forrest')).toBe(null);
  expect(pickSearchTitle(['James Forrest'], null)).toBe(null);
});

// --- fplFace: name within the matched team ONLY -----------------------------

test('fplFace: full-name match inside the containment-matched team', () => {
  // ESPN says 'Newcastle United'; FPL says 'Newcastle' — containment, unique.
  expect(fplFace(fplIndex, { name: 'Anthony Gordon', club: 'Newcastle United' }))
    .toBe(232826);
});

test('fplFace: exact team-name match works straight', () => {
  expect(fplFace(fplIndex, { name: 'Erling Haaland', club: 'Manchester City' }))
    .toBe(223094);
});

test('fplFace: ambiguous containment — Manchester matches neither Manchester club', () => {
  expect(fplFace(fplIndex, { name: 'Erling Haaland', club: 'Manchester' })).toBe(null);
});

test('fplFace: web_name falls back to the surname when unique in the team', () => {
  // 'Nick Pope' is not 'Nicholas Pope' in full, but web 'Pope' is unique there.
  expect(fplFace(fplIndex, { name: 'Nick Pope', club: 'Newcastle United' }))
    .toBe(98747);
});

test('fplFace: an ambiguous web_name surname inside the team is refused', () => {
  // Two Schades at Brentford — the surname fallback cannot pick one.
  expect(fplFace(fplIndex, { name: 'K. Schade', club: 'Brentford' })).toBe(null);
});

test('fplFace: NEVER matches across teams', () => {
  // Haaland exists in the index, but not at Liverpool.
  expect(fplFace(fplIndex, { name: 'Erling Haaland', club: 'Liverpool' })).toBe(null);
});

test('fplFace: unknown club, unknown player, or null inputs give null', () => {
  expect(fplFace(fplIndex, { name: 'James Forrest', club: 'Celtic' })).toBe(null);
  expect(fplFace(fplIndex, { name: 'Nobody Here', club: 'Liverpool' })).toBe(null);
  expect(fplFace(null, { name: 'Erling Haaland', club: 'Manchester City' })).toBe(null);
  expect(fplFace(fplIndex, { name: null, club: 'Liverpool' })).toBe(null);
  expect(fplFace(fplIndex, null)).toBe(null);
});

// --- tsdbFace: exact name, current team, honest misses ----------------------

const tsdbBraga = {
  name: 'Cláudio Braga', team: 'Aberdeen FC',
  cutout: 'https://r2.thesportsdb.com/braga-cutout.png',
  thumb: 'https://r2.thesportsdb.com/braga-thumb.png',
};

test('tsdbFace: exact name plus team containment gives the cutout', () => {
  expect(tsdbFace([tsdbBraga], { name: 'Cláudio Braga', club: 'Aberdeen' }))
    .toBe(tsdbBraga.cutout);
});

test('tsdbFace: falls to thumb when no cutout; null when neither', () => {
  expect(tsdbFace([{ ...tsdbBraga, cutout: null }],
    { name: 'Cláudio Braga', club: 'Aberdeen' })).toBe(tsdbBraga.thumb);
  expect(tsdbFace([{ ...tsdbBraga, cutout: null, thumb: null }],
    { name: 'Cláudio Braga', club: 'Aberdeen' })).toBe(null);
});

test('tsdbFace: TSDB team currency — a transferred player against a stale club is an honest miss', () => {
  // TSDB already knows the new club; our context still says the old one.
  const moved = { ...tsdbBraga, team: 'Feyenoord' };
  expect(tsdbFace([moved], { name: 'Cláudio Braga', club: 'Aberdeen' })).toBe(null);
});

test('tsdbFace: the name must be EQUAL, not merely contained', () => {
  const rugbyMan = {
    name: 'James Forrest Junior', team: 'Celtic',
    cutout: 'x.png', thumb: 'y.png',
  };
  expect(tsdbFace([rugbyMan], { name: 'James Forrest', club: 'Celtic' })).toBe(null);
});

test('tsdbFace: a wrong-team namesake earlier in the list never shadows the right man', () => {
  const namesake = { name: 'Cláudio Braga', team: 'Benfica', cutout: 'wrong.png', thumb: null };
  expect(tsdbFace([namesake, tsdbBraga], { name: 'Cláudio Braga', club: 'Aberdeen' }))
    .toBe(tsdbBraga.cutout);
});

test('tsdbFace: null inputs give null, never a throw', () => {
  expect(tsdbFace(null, { name: 'Cláudio Braga', club: 'Aberdeen' })).toBe(null);
  expect(tsdbFace([tsdbBraga], { name: null, club: 'Aberdeen' })).toBe(null);
  expect(tsdbFace([tsdbBraga], { name: 'Cláudio Braga', club: null })).toBe(null);
  expect(tsdbFace([tsdbBraga], null)).toBe(null);
});

// --- faceFor: the fallback order, with a source for the credit line ---------

test('faceFor: a verified Wikipedia portrait outranks everything', () => {
  expect(faceFor({ wiki: 'w.jpg', fplCode: 223094, tsdb: 't.png' }))
    .toEqual({ src: 'w.jpg', source: 'wikimedia' });
});

test('faceFor: the FPL code comes second, as a code for the caller to render', () => {
  expect(faceFor({ wiki: null, fplCode: 223094, tsdb: 't.png' }))
    .toEqual({ code: 223094, source: 'premier-league' });
});

test('faceFor: the TSDB url is the last face standing', () => {
  expect(faceFor({ wiki: null, fplCode: null, tsdb: 't.png' }))
    .toEqual({ src: 't.png', source: 'thesportsdb' });
});

test('faceFor: nothing verified means no face at all', () => {
  expect(faceFor({ wiki: null, fplCode: null, tsdb: null })).toBe(null);
  expect(faceFor({})).toBe(null);
  expect(faceFor(null)).toBe(null);
});

// --- creditFor: the plate credits, per source -------------------------------

test('creditFor: each source names its house', () => {
  expect(creditFor('wikimedia')).toBe('Wikimedia Commons');
  expect(creditFor('premier-league')).toBe('Premier League');
  expect(creditFor('thesportsdb')).toBe('TheSportsDB');
});

test('creditFor: unknown or null sources credit nothing', () => {
  expect(creditFor('espn')).toBe(null);
  expect(creditFor(null)).toBe(null);
});

// --- known as (spec §13.41): the abbreviation gap the audit found ---

const FPL_REAL_NAMES = { teams: [
  { id: 15, name: 'Man City' }, { id: 16, name: 'Man Utd' },
  { id: 18, name: "Nott'm Forest" }, { id: 19, name: 'Spurs' },
  { id: 20, name: 'Wolves' },
], players: [] };

test('the four audit nulls now resolve through the nickname ledger', () => {
  expect(fplTeamId(FPL_REAL_NAMES, 'Manchester City')).toBe(15);
  expect(fplTeamId(FPL_REAL_NAMES, 'Manchester United')).toBe(16);
  expect(fplTeamId(FPL_REAL_NAMES, 'Nottingham Forest')).toBe(18);
  expect(fplTeamId(FPL_REAL_NAMES, 'Tottenham Hotspur')).toBe(19);
  expect(fplTeamId(FPL_REAL_NAMES, 'Wolverhampton Wanderers')).toBe(20);
});

test('bare "Manchester" stays null — the ambiguity rule holds across alias forms too', () => {
  expect(fplTeamId(FPL_REAL_NAMES, 'Manchester')).toBeNull();
});

test('tsdbFace: team agreement accepts ledger forms — TSDB "Man City" meets ESPN "Manchester City"', () => {
  const players = [{ name: 'Erling Haaland', team: 'Man City', cutout: 'c.png', thumb: null }];
  expect(tsdbFace(players, { name: 'Erling Haaland', club: 'Manchester City' })).toBe('c.png');
});
