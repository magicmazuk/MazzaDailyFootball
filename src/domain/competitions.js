// The 13 competitions of spec §3.1, plus the season constants (Global
// Constraints). Zone maps drive the 2px margin ticks in league tables —
// they encode competition rules that can change season to season, so
// they are config, deliberately editable, not derived.

export const SEASON = {
  label: '2026-27',
  espnRange: '20260701-20270630',
  espnYear: 2026,
  bbcStart: '2026-07-01',
  bbcEnd: '2027-06-30',
};

const range = (from, to, zone) =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, zone]));

const league = { type: 'league', hasTable: true, hasSquads: true, hasMatchDetail: true };
const cup = { type: 'cup', hasTable: false, hasSquads: true, hasMatchDetail: true, zones: {} };

export const COMPETITIONS = [
  { ...league, id: 'sco.1', name: 'Scottish Premiership', shortName: 'Premiership',
    country: 'Scotland', source: 'espn', splitAfter: 6,
    zones: { 1: 'ucl', 2: 'uecl', 3: 'uecl', 11: 'po', 12: 'rel' } },
  { ...league, id: 'sco.2', name: 'Scottish Championship', shortName: 'Championship',
    country: 'Scotland', source: 'espn',
    zones: { 1: 'promo', 9: 'po', 10: 'rel' } },
  { ...league, id: 'scottish-league-one', name: 'Scottish League One', shortName: 'League One',
    country: 'Scotland', source: 'bbc', hasTable: 'computed', hasSquads: false, hasMatchDetail: false,
    zones: { 1: 'promo', 9: 'po', 10: 'rel' } },
  { ...league, id: 'scottish-league-two', name: 'Scottish League Two', shortName: 'League Two',
    country: 'Scotland', source: 'bbc', hasTable: 'computed', hasSquads: false, hasMatchDetail: false,
    zones: { 1: 'promo', 9: 'po' } },
  { ...cup, id: 'sco.tennents', name: 'Scottish Cup', shortName: 'Scottish Cup',
    country: 'Scotland', source: 'espn' },
  { ...cup, id: 'sco.cis', name: 'Scottish League Cup', shortName: 'League Cup',
    country: 'Scotland', source: 'espn', bbcTournament: 'scottish-league-cup' },
  { ...cup, id: 'sco.challenge', name: 'Scottish Challenge Cup', shortName: 'Challenge Cup',
    country: 'Scotland', source: 'espn' },
  { ...league, id: 'eng.1', name: 'English Premier League', shortName: 'Premier League',
    country: 'England', source: 'espn',
    zones: { ...range(1, 4, 'ucl'), 5: 'uecl', ...range(18, 20, 'rel') } },
  { ...cup, id: 'eng.fa', name: 'FA Cup', shortName: 'FA Cup',
    country: 'England', source: 'espn' },
  { ...cup, id: 'eng.league_cup', name: 'Carabao Cup', shortName: 'Carabao Cup',
    country: 'England', source: 'espn' },
  { ...cup, id: 'uefa.champions', name: 'UEFA Champions League', shortName: 'Champions League',
    country: 'Europe', source: 'espn', hasTable: true,
    zones: { ...range(1, 8, 'adv'), ...range(9, 24, 'po') } },
  { ...cup, id: 'uefa.europa', name: 'UEFA Europa League', shortName: 'Europa League',
    country: 'Europe', source: 'espn', hasTable: true,
    zones: { ...range(1, 8, 'adv'), ...range(9, 24, 'po') } },
  { ...cup, id: 'uefa.europa.conf', name: 'UEFA Conference League', shortName: 'Conference League',
    country: 'Europe', source: 'espn', hasTable: true,
    zones: { ...range(1, 8, 'adv'), ...range(9, 24, 'po') } },
];

export const byId = id => COMPETITIONS.find(c => c.id === id);

export const COMPETITION_GROUPS = ['Scotland', 'England', 'Europe'].map(country => [
  country,
  COMPETITIONS.filter(c => c.country === country),
]);
