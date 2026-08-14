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

test('(g) round is preserved through the merge — mergeCupFixtures spreads the BBC fixture, not just its sides', () => {
  const bbc = [bbcFixture({
    id: 'b5', kickoff: '2026-08-16T16:45:00Z', round: 'round-2',
    home: bbcSide('Ross County', 'bbc-rc'), away: bbcSide('Motherwell', 'bbc-mw'),
  })];
  const out = mergeCupFixtures([], bbc, new Map(), 'sco.cis');
  expect(out[0].round).toBe('round-2');
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

test('(h) buildTeamIndex also indexes by shortName, so a BBC side matching only the ESPN shortName alias re-identifies', () => {
  // ESPN's shortName for Inverness Caledonian Thistle is 'Inverness CT' — the
  // exact form the BBC feed uses as its full name for the same club.
  const index = buildTeamIndex([
    { id: '253', name: 'Inverness Caledonian Thistle', shortName: 'Inverness CT',
      crestUrl: 'https://espn/253.png', monogram: 'IN', colour: '00205b' },
  ]);
  const bbc = [bbcFixture({
    id: 'b6', kickoff: '2026-08-16T16:45:00Z',
    home: bbcSide('Inverness CT', 'bbc-ict'), away: bbcSide('Celtic', 'bbc-ce'),
  })];
  const out = mergeCupFixtures([], bbc, index, 'sco.cis');
  expect(out[0].home.teamId).toBe('253');
  expect(out[0].home.name).toBe('Inverness Caledonian Thistle');
});

test('(i) mergeCupFixtures harvests identities from espnFixtures sides, re-identifying clubs absent from any teams-endpoint list', () => {
  // Ross County never appears in the sco.1/sco.2 teams-endpoint lists that
  // feed buildTeamIndex, but it does appear as a side in an ESPN cup
  // fixture (its group-stage match) — that alone should be enough to
  // re-identify its later BBC-only fixture onto the same ESPN id.
  const espn = [espnFixture({
    id: 'e2', kickoff: '2026-07-20T14:00:00Z',
    home: espnSide('Ross County', '251'), away: espnSide('Motherwell', '119'),
  })];
  const bbc = [bbcFixture({
    id: 'b7', kickoff: '2026-08-16T16:45:00Z',
    home: bbcSide('Ross County', 'bbc-rc'), away: bbcSide('Dundee United', 'bbc-du2'),
  })];
  const out = mergeCupFixtures(espn, bbc, new Map(), 'sco.cis'); // empty teamIndex
  const extra = out.find(f => f.id === 'bbc-b7');
  expect(extra.home.teamId).toBe('251');
  expect(extra.home.crestUrl).toBe('https://espn/251.png');
});

test('(j) fixture-harvested identities never overwrite an existing teamIndex entry', () => {
  const index = buildTeamIndex([
    { id: 'canonical-256', name: 'Celtic', shortName: 'Celtic',
      crestUrl: 'https://espn/canonical.png', monogram: 'CE', colour: '009921' },
  ]);
  // An ESPN fixture also carries a 'Celtic' side (a different id, as if two
  // sources briefly disagreed) — the pre-existing index entry must win.
  const espn = [espnFixture({ home: espnSide('Dundee United', '1'), away: espnSide('Celtic', 'other-id') })];
  const bbc = [bbcFixture({
    id: 'b8', kickoff: '2026-08-16T16:45:00Z',
    home: bbcSide('Ayr United', 'bbc-ayr'), away: bbcSide('Celtic', 'bbc-ce'),
  })];
  const out = mergeCupFixtures(espn, bbc, index, 'sco.cis');
  const extra = out.find(f => f.id === 'bbc-b8');
  expect(extra.away.teamId).toBe('canonical-256');
});

test('(k) alias-aware match: BBC "The Spartans" matches an ESPN team indexed as "Spartans FC"', () => {
  const index = buildTeamIndex([
    { id: '888', name: 'Spartans FC', shortName: 'Spartans',
      crestUrl: 'https://espn/888.png', monogram: 'SP', colour: '000080' },
  ]);
  const bbc = [bbcFixture({
    id: 'b9', kickoff: '2026-08-16T16:45:00Z',
    home: bbcSide('The Spartans', 'bbc-spa'), away: bbcSide('Celtic', 'bbc-ce'),
  })];
  const out = mergeCupFixtures([], bbc, index, 'sco.cis');
  expect(out[0].home.teamId).toBe('888');
  expect(out[0].home.name).toBe('Spartans FC');
});

test('(l) dedupe compares post-alias names: an ESPN fixture and a BBC copy differing only by alias collapse to one row', () => {
  const espn = [espnFixture({
    home: espnSide('Spartans FC', '888'), away: espnSide('Celtic', '256'),
  })];
  const bbc = [bbcFixture({
    id: 'b10',
    home: bbcSide('The Spartans', 'bbc-spa'), away: bbcSide('Celtic', 'bbc-ce'),
  })];
  const out = mergeCupFixtures(espn, bbc, new Map(), 'sco.cis');
  expect(out).toHaveLength(1);
  expect(out[0].id).toBe('e1');
});
