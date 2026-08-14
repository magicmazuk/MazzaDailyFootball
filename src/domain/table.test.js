import { computeTable } from './table.js';

const side = (teamId, name, score) => ({
  teamId, name, shortName: name, crestUrl: null, monogram: 'XX', colour: null, score,
});
const ft = (h, a) => ({ status: 'ft', kickoff: '2026-08-01T14:00Z', home: h, away: a });

const fixtures = [
  ft(side('1', 'Ayr', 2), side('2', 'Arbroath', 0)),
  ft(side('2', 'Arbroath', 1), side('3', 'Cove', 1)),
  ft(side('3', 'Cove', 3), side('1', 'Ayr', 0)),
  // unplayed and live games must not count
  { status: 'scheduled', kickoff: '2027-01-01T15:00Z',
    home: side('1', 'Ayr', null), away: side('3', 'Cove', null) },
  { status: 'live', kickoff: '2026-08-08T15:00Z',
    home: side('2', 'Arbroath', 1), away: side('1', 'Ayr', 0) },
];

test('points, W/D/L and goals accumulate from full-time results only', () => {
  const t = computeTable(fixtures);
  const cove = t.find(r => r.name === 'Cove');
  expect(cove.played).toBe(2);
  expect(cove.won).toBe(1);
  expect(cove.drawn).toBe(1);
  expect(cove.points).toBe(4);
  expect(cove.goalsFor).toBe(4);
  expect(cove.goalsAgainst).toBe(1);
});

test('sort: points, then goal difference, then goals for; positions renumbered', () => {
  const t = computeTable(fixtures);
  // Cove 4pts. Ayr 3pts GD -1, Arbroath 1pt.
  expect(t.map(r => r.name)).toEqual(['Cove', 'Ayr', 'Arbroath']);
  expect(t.map(r => r.position)).toEqual([1, 2, 3]);
  expect(t[1].goalDifference).toBe(-1);
});

test('empty input gives an empty table', () => {
  expect(computeTable([])).toEqual([]);
});
