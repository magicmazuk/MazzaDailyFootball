import { adaptAthlete, adaptPlayerStats, isKeeper } from './player.js';

// Real probed shapes (spec §13.16 brief) — Kasper Høgh, ESPN id 272624,
// sco.1 season 2026: sports.core.api.espn.com/.../athletes/272624 and
// .../types/1/athletes/272624/statistics.
const outfieldAthlete = {
  id: '272624',
  displayName: 'Kasper Høgh',
  position: { id: '19', name: 'Forward', abbreviation: 'F' },
  jersey: '9',
  age: 25,
  citizenship: 'Denmark',
  displayHeight: "6' 1\"",
  dateOfBirth: '2000-12-06T08:00Z',
  birthPlace: {}, // the live feed returns an empty object here, not null
  defaultLeague: { $ref: 'http://sports.core.api.espn.com/v2/sports/soccer/leagues/sco.1?lang=en&region=us' },
};

const outfieldStats = {
  splits: {
    categories: [
      { name: 'defensive', stats: [
        { name: 'effectiveTackles', value: 1 },
        { name: 'interceptions', value: 0 },
      ] },
      { name: 'general', stats: [
        { name: 'appearances', value: 2 },
        { name: 'starts', value: 2 },
        { name: 'minutes', value: 172 },
        { name: 'foulsCommitted', value: 3 },
        { name: 'yellowCards', value: 0 },
        { name: 'redCards', value: 0 },
        { name: 'passPct', value: 0.605 },
        { name: 'avgRatingFromDataFeed', value: 0 }, // 0 = unrated
      ] },
      { name: 'goalKeeping', stats: [
        { name: 'cleanSheet', value: 1 },
        { name: 'goalsConceded', value: 1 },
        { name: 'saves', value: 0 },
      ] },
      { name: 'offensive', stats: [
        { name: 'totalGoals', value: 3 },
        { name: 'goalAssists', value: 0 },
        { name: 'shotsOnTarget', value: 5 },
        { name: 'shotsOffTarget', value: 4 },
        { name: 'totalShots', value: 13 },
        { name: 'accuratePasses', value: 23 },
        { name: 'inaccuratePasses', value: 15 },
        { name: 'totalPasses', value: 38 },
      ] },
    ],
  },
};

test('adaptAthlete: maps the probed outfield-player shape, with an empty birthPlace object mapping to null', () => {
  expect(adaptAthlete(outfieldAthlete)).toEqual({
    id: '272624',
    name: 'Kasper Høgh',
    position: 'Forward',
    shirt: '9',
    age: 25,
    nationality: 'Denmark',
    heightDisplay: "6' 1\"",
    birthDate: '2000-12-06T08:00Z',
    birthPlace: null,
    defaultLeagueCode: 'sco.1',
  });
});

// Production hotfix (Aug 2026): defaultLeague.$ref carries the player's
// domestic league code — this is what lets usePlayer route the
// statistics fetch correctly even when reached via a UEFA/cup comp.
test('adaptAthlete: extracts defaultLeagueCode from defaultLeague.$ref', () => {
  expect(adaptAthlete({
    defaultLeague: { $ref: 'http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1?lang=en&region=us' },
  }).defaultLeagueCode).toBe('eng.1');
});

test('adaptAthlete: defaultLeagueCode is null when defaultLeague is absent', () => {
  expect(adaptAthlete({}).defaultLeagueCode).toBeNull();
  expect(adaptAthlete({ defaultLeague: {} }).defaultLeagueCode).toBeNull();
});

test('adaptAthlete: birthPlace joins city/state/country when present', () => {
  expect(adaptAthlete({ birthPlace: { city: 'Glasgow', country: 'Scotland' } }).birthPlace)
    .toBe('Glasgow, Scotland');
  expect(adaptAthlete({ birthPlace: { city: 'Dallas', state: 'TX', country: 'USA' } }).birthPlace)
    .toBe('Dallas, TX, USA');
});

test('adaptAthlete: null-safe for a missing/empty payload, name falls back to Unknown', () => {
  expect(adaptAthlete({})).toEqual({
    id: null, name: 'Unknown', position: null, shirt: null, age: null,
    nationality: null, heightDisplay: null, birthDate: null, birthPlace: null,
    defaultLeagueCode: null,
  });
  expect(adaptAthlete(undefined)).toEqual(adaptAthlete({}));
});

test('adaptPlayerStats: maps the probed outfield-player statistics — goals 3, minutes 172, passPct .605, shots 13/5', () => {
  const s = adaptPlayerStats(outfieldStats);
  expect(s).toEqual({
    appearances: 2, starts: 2, minutes: 172, goals: 3, assists: 0,
    shotsOnTarget: 5, shotsOffTarget: 4, totalShots: 13,
    accuratePasses: 23, inaccuratePasses: 15, totalPasses: 38, passPct: 0.605,
    foulsCommitted: 3, yellowCards: 0, redCards: 0, effectiveTackles: 1,
    saves: 0, cleanSheets: 1, goalsConceded: 1, rating: null,
  });
});

// Synthetic keeper sample per the brief: saves/cleanSheets present with
// real values, the whole offensive category absent (not zeroed) so
// every shot/pass/goal/assist stat sourced from it comes back null.
const keeperStats = {
  splits: {
    categories: [
      { name: 'defensive', stats: [{ name: 'effectiveTackles', value: 0 }] },
      { name: 'general', stats: [
        { name: 'appearances', value: 5 },
        { name: 'starts', value: 5 },
        { name: 'minutes', value: 450 },
        { name: 'foulsCommitted', value: 1 },
        { name: 'yellowCards', value: 0 },
        { name: 'redCards', value: 0 },
        { name: 'passPct', value: 0.82 },
        { name: 'avgRatingFromDataFeed', value: 6.8 },
      ] },
      { name: 'goalKeeping', stats: [
        { name: 'cleanSheet', value: 3 },
        { name: 'goalsConceded', value: 4 },
        { name: 'saves', value: 14 },
      ] },
      // no 'offensive' category at all for this player
    ],
  },
};

test('adaptPlayerStats: keeper sample — saves/cleanSheets present, shots/goals/assists/passes absent map to null (not 0)', () => {
  const s = adaptPlayerStats(keeperStats);
  expect(s.saves).toBe(14);
  expect(s.cleanSheets).toBe(3);
  expect(s.goalsConceded).toBe(4);
  expect(s.minutes).toBe(450);
  expect(s.passPct).toBe(0.82);
  expect(s.goals).toBeNull();
  expect(s.assists).toBeNull();
  expect(s.shotsOnTarget).toBeNull();
  expect(s.shotsOffTarget).toBeNull();
  expect(s.totalShots).toBeNull();
  expect(s.accuratePasses).toBeNull();
  expect(s.inaccuratePasses).toBeNull();
  expect(s.totalPasses).toBeNull();
  expect(s.rating).toBe(6.8); // non-zero rating passes through untouched
});

test('adaptPlayerStats: empty payload is all-null, including rating', () => {
  const s = adaptPlayerStats({});
  expect(Object.values(s).every(v => v === null)).toBe(true);
  expect(adaptPlayerStats({ splits: { categories: [] } })).toEqual(s);
  expect(adaptPlayerStats(undefined)).toEqual(s);
});

test('adaptPlayerStats: a rating of exactly 0 maps to null — the feed uses 0 for "unrated"', () => {
  const zeroRated = { splits: { categories: [
    { name: 'general', stats: [{ name: 'avgRatingFromDataFeed', value: 0 }] },
  ] } };
  expect(adaptPlayerStats(zeroRated).rating).toBeNull();
});

test('isKeeper: true for a Goalkeeper position, false for outfield positions, false when absent', () => {
  expect(isKeeper({ position: 'Goalkeeper' })).toBe(true);
  expect(isKeeper(adaptAthlete({ position: { name: 'Goalkeeper' } }))).toBe(true);
  expect(isKeeper({ position: 'Forward' })).toBe(false);
  expect(isKeeper(adaptAthlete(outfieldAthlete))).toBe(false);
  expect(isKeeper({})).toBe(false);
  expect(isKeeper(undefined)).toBe(false);
});
