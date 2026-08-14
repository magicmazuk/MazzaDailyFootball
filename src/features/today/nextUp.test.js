import { nextUpForFollowed } from './nextUp.js';

const side = (teamId, name) => ({ teamId, name: name ?? teamId, score: null });
const fx = (id, kickoff, status, h, a) =>
  ({ id, compId: 'sco.1', kickoff, status, home: side(h), away: side(a), tv: [] });
const now = new Date('2026-08-22T10:00:00Z');
const clubs = [
  { id: '256', name: 'Celtic' },
  { id: '254', name: 'Falkirk' },
  { id: '999', name: 'Nowhere FC' },
];
const fixtures = [
  fx('1', '2026-08-22T14:00:00Z', 'scheduled', '256', '267'),  // Celtic play TODAY
  fx('2', '2026-08-29T14:00:00Z', 'scheduled', '256', '263'),
  fx('3', '2026-08-25T18:45:00Z', 'scheduled', '254', '250'),  // Falkirk next Tuesday
  fx('4', '2026-08-15T14:00:00Z', 'ft', '254', '260'),
];

test('clubs playing today are excluded; others get their next fixture, soonest first', () => {
  const out = nextUpForFollowed(clubs, fixtures, now);
  expect(out).toHaveLength(1);
  expect(out[0].club.id).toBe('254');
  expect(out[0].fixture.id).toBe('3');
});

test('a club with nothing upcoming is omitted, not crashed on', () => {
  expect(nextUpForFollowed([{ id: '999', name: 'X' }], fixtures, now)).toEqual([]);
});

test('sorted soonest first across clubs', () => {
  const out = nextUpForFollowed(
    [{ id: '263', name: 'Aberdeen' }, { id: '254', name: 'Falkirk' }],
    [...fixtures, fx('5', '2026-08-23T14:00:00Z', 'scheduled', '263', '266')], now);
  expect(out.map(x => x.club.id)).toEqual(['263', '254']);
});
