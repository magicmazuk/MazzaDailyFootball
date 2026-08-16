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

// The blurb (spec §13.17): the competition's structure as two lines of
// hand-written broadsheet prose — the overview's only structural chrome
// since the strip retired. Editorial, curated per season like tvListings:
// verify each sentence still holds when a new season's format lands.
const UEFA_BLURB = 'Thirty-six clubs, one league phase. The top 8 go straight to the last 16; '
  + '9th–24th meet in a two-legged play-off for the other eight places. Knockout to the final.';

// espnQualifier (spec §13.11): ESPN publishes each UEFA club competition's
// qualifying rounds under a separate league code from its league-phase-
// onward code. queries.js fetches both and merges them under this comp's
// id so qualifying clubs appear tiered on the same Overview page.

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
    country: 'Scotland', source: 'espn',
    blurb: 'A straight knockout, open to the whole senior game. Clubs enter in waves, the Premiership joining in the fourth round.' },
  { ...cup, id: 'sco.cis', name: 'Scottish League Cup', shortName: 'League Cup',
    country: 'Scotland', source: 'espn', bbcTournament: 'scottish-league-cup',
    blurb: 'Forty clubs open the season in eight groups of five. The eight group winners and three best runners-up go through, and the five clubs bound for Europe join them in the last 16. Straight knockout from there.' },
  { ...cup, id: 'sco.challenge', name: 'Scottish Challenge Cup', shortName: 'Challenge Cup',
    country: 'Scotland', source: 'espn',
    blurb: 'The cup for the leagues below the Premiership. Regional in the early rounds, then a straight knockout to the final.' },
  { ...league, id: 'eng.1', name: 'English Premier League', shortName: 'Premier League',
    country: 'England', source: 'espn',
    zones: { ...range(1, 4, 'ucl'), 5: 'uecl', ...range(18, 20, 'rel') } },
  { ...cup, id: 'eng.fa', name: 'FA Cup', shortName: 'FA Cup',
    country: 'England', source: 'espn',
    blurb: 'A straight knockout open to every level of the English game, from the qualifying rounds up. The top flight enters in the third round.' },
  { ...cup, id: 'eng.league_cup', name: 'Carabao Cup', shortName: 'Carabao Cup',
    country: 'England', source: 'espn',
    blurb: 'A knockout for the 92 league clubs alone. Clubs in Europe wait until the third round; the semi-finals are the one stage played over two legs.' },
  { ...cup, id: 'uefa.champions', name: 'UEFA Champions League', shortName: 'Champions League',
    country: 'Europe', source: 'espn', hasTable: true,
    zones: { ...range(1, 8, 'adv'), ...range(9, 24, 'po') },
    blurb: UEFA_BLURB, espnQualifier: 'uefa.champions_qual' },
  { ...cup, id: 'uefa.europa', name: 'UEFA Europa League', shortName: 'Europa League',
    country: 'Europe', source: 'espn', hasTable: true,
    zones: { ...range(1, 8, 'adv'), ...range(9, 24, 'po') },
    blurb: UEFA_BLURB, espnQualifier: 'uefa.europa_qual' },
  { ...cup, id: 'uefa.europa.conf', name: 'UEFA Conference League', shortName: 'Conference League',
    country: 'Europe', source: 'espn', hasTable: true,
    zones: { ...range(1, 8, 'adv'), ...range(9, 24, 'po') },
    blurb: UEFA_BLURB, espnQualifier: 'uefa.europa.conf_qual' },
];

export const byId = id => COMPETITIONS.find(c => c.id === id);

export const COMPETITION_GROUPS = ['Scotland', 'England', 'Europe'].map(country => [
  country,
  COMPETITIONS.filter(c => c.country === country),
]);
