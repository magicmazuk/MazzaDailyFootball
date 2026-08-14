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
