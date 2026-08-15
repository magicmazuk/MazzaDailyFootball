import { teamFixtures, phaseReplayGroups } from './teamFixtures.js';

const side = (teamId, score = null) => ({ teamId, name: teamId, score });
const fx = (id, kickoff, status, h, a) => ({ id, kickoff, status, home: side(h), away: side(a) });

const now = new Date('2026-08-22T12:00:00Z');
const all = [
  fx('1', '2026-08-01T14:00:00Z', 'ft', 'CEL', 'RAN'),
  fx('2', '2026-08-29T14:00:00Z', 'scheduled', 'ABE', 'CEL'),
  fx('3', '2026-08-15T14:00:00Z', 'ft', 'CEL', 'HEA'),
  fx('4', '2026-09-05T14:00:00Z', 'scheduled', 'CEL', 'STM'),
  fx('5', '2026-08-10T14:00:00Z', 'ft', 'DUN', 'ABE'), // not Celtic — excluded
  fx('6', '2026-08-23T14:00:00Z', 'postponed', 'CEL', 'KIL'), // postponed is not "next"
];

test('filters to the team and sorts by kickoff', () => {
  const t = teamFixtures(all, 'CEL', now);
  expect(t.all.map(f => f.id)).toEqual(['1', '3', '6', '2', '4']);
});

test('next is the first future scheduled fixture; last is the most recent result', () => {
  const t = teamFixtures(all, 'CEL', now);
  expect(t.next.id).toBe('2');
  expect(t.last.id).toBe('3');
});

test('a team with nothing upcoming or played gives nulls, not crashes', () => {
  expect(teamFixtures([], 'CEL', now)).toEqual({ all: [], next: null, last: null });
});

// ------------------------------------------------------ phaseReplayGroups
// The team-page replay-link candidates (spec §13.15): a club's own
// (compId, round) phase groups with >=2 fixtures, browsable regardless of
// seen-state or followed-ness.

const phaseFx = (id, compId, round, kickoff, status = 'scheduled') =>
  ({ id, compId, kickoff, status, round, home: side('CEL'), away: side('OPP') });

test('a comp/round with 2+ phase fixtures for the team is returned', () => {
  const fixtures = [
    phaseFx('1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z'),
    phaseFx('2', 'uefa.champions', 'league-phase', '2026-09-02T15:00:00Z'),
  ];
  expect(phaseReplayGroups(fixtures)).toEqual([{ compId: 'uefa.champions', round: 'league-phase' }]);
});

test('a comp/round with only 1 phase fixture is not returned (broadcast scheduling, not a draw)', () => {
  const fixtures = [phaseFx('1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z')];
  expect(phaseReplayGroups(fixtures)).toEqual([]);
});

test('a knockout-round fixture never counts, even 2+', () => {
  const fixtures = [
    phaseFx('1', 'sco.tennents', 'fourth-round', '2026-09-01T15:00:00Z'),
    phaseFx('2', 'sco.tennents', 'fourth-round', '2026-09-02T15:00:00Z'),
  ];
  expect(phaseReplayGroups(fixtures)).toEqual([]);
});

test('a fixture with any status (scheduled or played) still counts — replay links are browsable in any seen/played state', () => {
  const fixtures = [
    phaseFx('1', 'uefa.champions', 'group-stage', '2026-09-01T15:00:00Z', 'ft'),
    phaseFx('2', 'uefa.champions', 'group-stage', '2026-09-02T15:00:00Z', 'scheduled'),
  ];
  expect(phaseReplayGroups(fixtures)).toEqual([{ compId: 'uefa.champions', round: 'group-stage' }]);
});

test('multiple comps each with a qualifying phase group yield one entry each', () => {
  const fixtures = [
    phaseFx('1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z'),
    phaseFx('2', 'uefa.champions', 'league-phase', '2026-09-02T15:00:00Z'),
    phaseFx('3', 'sco.challenge', 'league-phase', '2026-08-01T15:00:00Z'),
    phaseFx('4', 'sco.challenge', 'league-phase', '2026-08-08T15:00:00Z'),
  ];
  expect(phaseReplayGroups(fixtures)).toEqual([
    { compId: 'uefa.champions', round: 'league-phase' },
    { compId: 'sco.challenge', round: 'league-phase' },
  ]);
});

test('an empty fixture list gives an empty result, not a crash', () => {
  expect(phaseReplayGroups([])).toEqual([]);
});
