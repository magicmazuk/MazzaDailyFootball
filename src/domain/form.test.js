import { formGuide } from './form.js';

const side = (teamId, score) => ({ teamId, name: teamId, score });
const f = (kickoff, h, hs, a, as, status = 'ft') =>
  ({ status, kickoff, home: side(h, hs), away: side(a, as) });

const fixtures = [
  f('2026-08-01T14:00Z', 'CEL', 2, 'RAN', 0),
  f('2026-08-08T14:00Z', 'ABE', 1, 'CEL', 1),
  f('2026-08-15T14:00Z', 'CEL', 0, 'HEA', 3),
  f('2026-08-22T14:00Z', 'CEL', 1, 'DUN', 0),
  f('2026-08-29T14:00Z', 'STM', 0, 'CEL', 2),
  f('2026-09-05T14:00Z', 'CEL', 4, 'KIL', 0),
  f('2026-09-12T14:00Z', 'CEL', 0, 'RAN', 0, 'scheduled'), // future — ignored
];

test('last five completed results, oldest first, from home and away', () => {
  expect(formGuide(fixtures, 'CEL')).toEqual(['D', 'L', 'W', 'W', 'W']);
});

test('n limits the window', () => {
  expect(formGuide(fixtures, 'CEL', 2)).toEqual(['W', 'W']);
});

test('team with no completed games has empty form', () => {
  expect(formGuide(fixtures, 'NOPE')).toEqual([]);
});
