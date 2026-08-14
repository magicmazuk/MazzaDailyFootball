import { buildTeamIndex, mergeCupFixtures } from './mergeCup.js';

const espnSide = (name, teamId, score = null) => ({
  teamId, name, shortName: name, crestUrl: `https://espn/${teamId}.png`,
  monogram: name.slice(0, 2).toUpperCase(), colour: '000000', score,
});

const bbcSide = (name, teamId, score = null) => ({
  teamId, name, shortName: name, crestUrl: null,
  monogram: name.slice(0, 2).toUpperCase(), colour: null, score,
});

const espnFixture = (over = {}) => ({
  id: 'e1', compId: 'sco.cis', kickoff: '2026-08-15T16:45:00Z', status: 'scheduled',
  minute: null, round: null, venue: 'Tannadice',
  home: espnSide('Dundee United', '1'), away: espnSide('Celtic', '256'),
  ...over,
});

const bbcFixture = (over = {}) => ({
  id: 'b1', compId: 'scottish-league-cup', kickoff: '2026-08-15T16:45:00Z', status: 'scheduled',
  minute: null, round: null, venue: null,
  home: bbcSide('Dundee United', 'bbc-du'), away: bbcSide('Celtic', 'bbc-ce'),
  ...over,
});

test('buildTeamIndex indexes team lists by normalized name, first list wins on duplicates', () => {
  const list1 = [{ id: '1', name: 'Dundee United' }];
  const list2 = [{ id: '1-dup', name: 'Dundee United' }, { id: '2', name: 'Celtic' }];
  const index = buildTeamIndex(list1, list2);
  expect(index.get('dundeeunited').id).toBe('1');
  expect(index.get('celtic').id).toBe('2');
});

test('buildTeamIndex tolerates missing/null lists', () => {
  const index = buildTeamIndex(null, undefined, [{ id: '1', name: 'Celtic' }]);
  expect(index.get('celtic').id).toBe('1');
});

test('(a) a BBC fixture matching an ESPN fixture on date+home+away is dropped, no duplicate', () => {
  const espn = [espnFixture()];
  const bbc = [bbcFixture()];
  const out = mergeCupFixtures(espn, bbc, new Map(), 'sco.cis');
  expect(out).toHaveLength(1);
  expect(out[0].id).toBe('e1');
});

test('(b) a BBC-only fixture is added with a bbc- id prefix and the given compId', () => {
  const espn = [espnFixture()];
  const bbc = [bbcFixture({
    id: 'b2', kickoff: '2026-08-16T16:45:00Z',
    home: bbcSide('Ross County', 'bbc-rc'), away: bbcSide('Motherwell', 'bbc-mw'),
  })];
  const out = mergeCupFixtures(espn, bbc, new Map(), 'sco.cis');
  expect(out).toHaveLength(2);
  const extra = out.find(f => f.id !== 'e1');
  expect(extra.id).toBe('bbc-b2');
  expect(extra.compId).toBe('sco.cis');
});

test('(c) re-identification maps a BBC side onto an ESPN team index entry, preserving BBC score', () => {
  const index = buildTeamIndex([
    { id: '256', name: 'Celtic', crestUrl: 'https://espn/256.png', monogram: 'CE',
      colour: '009921', shortName: 'Celtic' },
  ]);
  const bbc = [bbcFixture({
    id: 'b3', kickoff: '2026-08-16T16:45:00Z',
    home: bbcSide('Ayr United', 'bbc-ayr'),
    away: bbcSide('Celtic', 'bbc-ce', 2),
  })];
  const out = mergeCupFixtures([], bbc, index, 'sco.cis');
  const away = out[0].away;
  expect(away.teamId).toBe('256');
  expect(away.crestUrl).toBe('https://espn/256.png');
  expect(away.score).toBe(2);
});

test('(d) a club absent from the index keeps its own BBC identity and monogram', () => {
  const bbc = [bbcFixture({
    id: 'b4', kickoff: '2026-08-16T16:45:00Z',
    home: bbcSide('Ayr United', 'bbc-ayr'), away: bbcSide('Celtic', 'bbc-ce'),
  })];
  const out = mergeCupFixtures([], bbc, new Map(), 'sco.cis');
  const home = out[0].home;
  expect(home.teamId).toBe('bbc-ayr');
  expect(home.monogram).toBe('AY');
  expect(home.crestUrl).toBeNull();
});

test('(e) output is sorted by kickoff', () => {
  const espn = [espnFixture({ id: 'e-later', kickoff: '2026-08-20T16:45:00Z' })];
  const bbc = [bbcFixture({
    id: 'b-earlier', kickoff: '2026-08-10T12:00:00Z',
    home: bbcSide('Ross County', 'bbc-rc'), away: bbcSide('Motherwell', 'bbc-mw'),
  })];
  const out = mergeCupFixtures(espn, bbc, new Map(), 'sco.cis');
  expect(out.map(f => f.id)).toEqual(['bbc-b-earlier', 'e-later']);
});

test('(f) name matching is case/punctuation-insensitive but exact, no fuzzy', () => {
  const espn = [espnFixture()]; // 'Dundee United' v 'Celtic'
  const bbc = [
    bbcFixture({ id: 'b-dup', home: bbcSide('DUNDEE   united!!', 'x'), away: bbcSide('celtic', 'y') }),
    bbcFixture({
      id: 'b-hearts', kickoff: '2026-08-17T15:00:00Z',
      home: bbcSide('Heart of Midlothian', 'bbc-hom'), away: bbcSide('Hibernian', 'bbc-hib'),
    }),
  ];
  const index = buildTeamIndex([{ id: '999', name: 'Hearts', shortName: 'Hearts',
    crestUrl: 'https://espn/999.png', monogram: 'HE', colour: '7c0000' }]);
  const out = mergeCupFixtures(espn, bbc, index, 'sco.cis');
  // The punctuation/case-different duplicate is dropped (matches on normalized equality).
  expect(out).toHaveLength(2);
  // 'Heart of Midlothian' does NOT normalize-match 'Hearts' — stays unidentified.
  const heartsFixture = out.find(f => f.id === 'bbc-b-hearts');
  expect(heartsFixture.home.teamId).toBe('bbc-hom');
  expect(heartsFixture.home.name).toBe('Heart of Midlothian');
});
