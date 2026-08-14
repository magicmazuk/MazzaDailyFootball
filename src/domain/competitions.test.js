import { COMPETITIONS, byId, COMPETITION_GROUPS, SEASON } from './competitions.js';

test('registry holds exactly the 13 competitions of spec §3.1', () => {
  expect(COMPETITIONS).toHaveLength(13);
  expect(COMPETITIONS.filter(c => c.source === 'bbc').map(c => c.id)).toEqual([
    'scottish-league-one', 'scottish-league-two',
  ]);
});

test('byId finds the Premiership with split and zones', () => {
  const p = byId('sco.1');
  expect(p.splitAfter).toBe(6);
  expect(p.zones[1]).toBe('ucl');
  expect(p.zones[12]).toBe('rel');
  expect(p.hasSquads).toBe(true);
});

test('BBC leagues compute their tables and carry no squads or match detail', () => {
  const l1 = byId('scottish-league-one');
  expect(l1.hasTable).toBe('computed');
  expect(l1.hasSquads).toBe(false);
  expect(l1.hasMatchDetail).toBe(false);
});

test('UEFA league phases mark 1-8 advancing and 9-24 play-off', () => {
  const ucl = byId('uefa.champions');
  expect(ucl.hasTable).toBe(true);
  expect(ucl.zones[8]).toBe('adv');
  expect(ucl.zones[9]).toBe('po');
  expect(ucl.zones[24]).toBe('po');
  expect(ucl.zones[25]).toBeUndefined();
});

test('groups are Scotland, England, Europe in order', () => {
  expect(COMPETITION_GROUPS.map(([name]) => name)).toEqual(['Scotland', 'England', 'Europe']);
});

test('season constants are the 2026-27 season', () => {
  expect(SEASON.espnRange).toBe('20260701-20270630');
  expect(SEASON.espnYear).toBe(2026);
});

test('the League Cup declares its BBC fallback tournament', () => {
  expect(byId('sco.cis').bbcTournament).toBe('scottish-league-cup');
});

test('every cup has a non-empty structure strip; leagues have none', () => {
  const cups = COMPETITIONS.filter(c => c.type === 'cup');
  const leagues = COMPETITIONS.filter(c => c.type === 'league');
  expect(cups).toHaveLength(8);
  expect(leagues).toHaveLength(5);
  for (const c of cups) {
    expect(Array.isArray(c.structure)).toBe(true);
    expect(c.structure.length).toBeGreaterThan(0);
  }
  for (const l of leagues) {
    expect(l.structure).toBeUndefined();
  }
});

test('the three UEFA club competitions share the same structure strip', () => {
  expect(byId('uefa.champions').structure).toEqual(byId('uefa.europa').structure);
  expect(byId('uefa.europa').structure).toEqual(byId('uefa.europa.conf').structure);
  expect(byId('uefa.champions').structure[0]).toEqual({ n: 36, label: 'league phase' });
});

test('the three UEFA club competitions declare their ESPN qualifying-rounds code (spec §13.11)', () => {
  expect(byId('uefa.champions').espnQualifier).toBe('uefa.champions_qual');
  expect(byId('uefa.europa').espnQualifier).toBe('uefa.europa_qual');
  expect(byId('uefa.europa.conf').espnQualifier).toBe('uefa.europa.conf_qual');
});
