import { groupFixturesByRound } from './roundGroups.js';

const side = (teamId, name) => ({ teamId, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase() });

const fx = (id, round, kickoff) =>
  ({ id, compId: 'sco.tennents', kickoff, status: 'scheduled', minute: null, round, venue: null,
    home: side('1', 'Alpha'), away: side('2', 'Bravo') });

// ---------------------------------------------------- multi-round cup

test('groups a multi-round cup by round, in kickoff order, each with its labelled header', () => {
  const fixtures = [
    fx('1', 'quarterfinals', '2026-04-01T15:00:00Z'),
    fx('2', 'fourth-round', '2026-02-01T15:00:00Z'),
    fx('3', 'fourth-round', '2026-02-02T15:00:00Z'), // second fixture, same round, different day
  ];
  const groups = groupFixturesByRound(fixtures);
  expect(groups.map(g => g.round)).toEqual(['fourth-round', 'quarterfinals']);
  expect(groups.map(g => g.label)).toEqual(['Fourth round', 'Quarter-finals']);
  // The earlier round groups its two different-day fixtures into two date sub-groups.
  expect(groups[0].days).toHaveLength(2);
  expect(groups[1].days).toHaveLength(1);
});

test('reverse:true (the Results tab) reverses round order without touching date sub-grouping', () => {
  const fixtures = [
    fx('1', 'quarterfinals', '2026-04-01T15:00:00Z'),
    fx('2', 'fourth-round', '2026-02-01T15:00:00Z'),
  ];
  const groups = groupFixturesByRound(fixtures, { reverse: true });
  expect(groups.map(g => g.round)).toEqual(['quarterfinals', 'fourth-round']);
});

test('an excluded-but-fallback-labelled round (group-stage) still gets a header via fallbackRoundLabel', () => {
  const fixtures = [fx('1', 'group-stage', '2026-01-01T15:00:00Z')];
  const groups = groupFixturesByRound(fixtures);
  expect(groups).toEqual([{ round: 'group-stage', label: 'Group Stage', days: expect.any(Array) }]);
});

// ---------------------------------------------------- league (no rounds)

test('a league (no fixture carries a displayable round) falls back to a single flat date grouping', () => {
  const fixtures = [
    fx('1', null, '2026-01-01T15:00:00Z'),
    fx('2', null, '2026-01-02T15:00:00Z'),
  ];
  const groups = groupFixturesByRound(fixtures);
  // Single group, null round/label marker — CompetitionScreen keys off
  // `label` being null to skip rendering a round heading entirely.
  expect(groups).toHaveLength(1);
  expect(groups[0].round).toBeNull();
  expect(groups[0].label).toBeNull();
  expect(groups[0].days).toHaveLength(2);
});

test('a year-prefixed league season slug on every fixture is also treated as no displayable round', () => {
  const fixtures = [
    fx('1', '2026-27-scottish-premiership', '2026-01-01T15:00:00Z'),
    fx('2', '2026-27-scottish-premiership', '2026-01-02T15:00:00Z'),
  ];
  const groups = groupFixturesByRound(fixtures);
  expect(groups).toEqual([{ round: null, label: null, days: expect.any(Array) }]);
});

test('empty input yields a single empty flat group, never throws', () => {
  expect(groupFixturesByRound([])).toEqual([{ round: null, label: null, days: [] }]);
  expect(groupFixturesByRound(undefined)).toEqual([{ round: null, label: null, days: [] }]);
});

// ---------------------------------------------------- null-round stragglers

test('null-round stragglers alongside real rounds land in a trailing "Other fixtures" group', () => {
  const fixtures = [
    fx('1', 'fourth-round', '2026-02-01T15:00:00Z'),
    fx('2', null, '2026-01-15T15:00:00Z'),
    fx('3', 'quarterfinals', '2026-04-01T15:00:00Z'),
  ];
  const groups = groupFixturesByRound(fixtures);
  expect(groups.map(g => g.label)).toEqual(['Fourth round', 'Quarter-finals', 'Other fixtures']);
  expect(groups.at(-1).days.flatMap(([, list]) => list.map(f => f.id))).toEqual(['2']);
});

test('"Other fixtures" stays trailing even when round order is reversed for the Results tab', () => {
  const fixtures = [
    fx('1', 'fourth-round', '2026-02-01T15:00:00Z'),
    fx('2', null, '2026-01-15T15:00:00Z'),
    fx('3', 'quarterfinals', '2026-04-01T15:00:00Z'),
  ];
  const groups = groupFixturesByRound(fixtures, { reverse: true });
  expect(groups.map(g => g.label)).toEqual(['Quarter-finals', 'Fourth round', 'Other fixtures']);
});
