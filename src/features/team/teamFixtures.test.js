import { teamFixtures } from './teamFixtures.js';

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
