import { partitionToday } from './partition.js';

const side = teamId => ({ teamId, name: teamId, crestUrl: null, monogram: 'XX', score: null });
const fx = (id, kickoff, status, h, a) =>
  ({ id, compId: 'sco.1', kickoff, status, minute: null, home: side(h), away: side(a) });

const now = new Date('2026-08-22T15:30:00Z');
const fixtures = [
  fx('1', '2026-08-22T14:00:00Z', 'live', '256', '267'),      // Celtic live — followed
  fx('2', '2026-08-22T14:00:00Z', 'live', '260', '258'),      // other live
  fx('3', '2026-08-22T16:45:00Z', 'scheduled', '261', '264'), // later today
  fx('4', '2026-08-22T11:00:00Z', 'ft', '266', '263'),        // finished earlier today
  fx('5', '2026-08-21T14:00:00Z', 'ft', '250', '256'),        // yesterday, followed
  fx('6', '2026-08-21T14:00:00Z', 'ft', '254', '262'),        // yesterday
  fx('7', '2026-08-22T14:00:00Z', 'postponed', '999', '998'), // postponed today
];
const followed = new Set(['256']);

test('followed clubs go to yours regardless of status', () => {
  const p = partitionToday(fixtures, followed, now);
  expect(p.yours.map(f => f.id)).toEqual(['1']);
  expect(p.live.map(f => f.id)).toEqual(['2']); // not the followed one
});

test('today splits into later and earlier; postponed sits with earlier', () => {
  const p = partitionToday(fixtures, followed, now);
  expect(p.later.map(f => f.id)).toEqual(['3']);
  expect(p.earlier.map(f => f.id)).toEqual(['4', '7']);
});

test('yesterday is separate, followed clubs first', () => {
  const p = partitionToday(fixtures, followed, now);
  expect(p.yesterday.map(f => f.id)).toEqual(['5', '6']);
});

test('a quiet day yields empty sections, not crashes', () => {
  const p = partitionToday([], followed, now);
  expect(p.yours).toEqual([]);
  expect(p.live).toEqual([]);
});
