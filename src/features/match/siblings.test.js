import { siblingFixtures } from './siblings.js';

const fx = (id, over = {}) => ({
  id, compId: 'sco.1', kickoff: '2026-08-22T14:00:00Z', round: null,
  status: 'scheduled', ...over,
});

test('round mode: fixture.round non-null groups by the same round, ignoring date', () => {
  const self = fx('e1', { round: 'fourth-round', kickoff: '2026-08-22T14:00:00Z' });
  const sameRoundDifferentDay = fx('e2', { round: 'fourth-round', kickoff: '2026-08-23T14:00:00Z' });
  const differentRound = fx('e3', { round: 'fifth-round', kickoff: '2026-08-22T15:00:00Z' });
  const out = siblingFixtures([self, sameRoundDifferentDay, differentRound], self);
  expect(out.map(f => f.id)).toEqual(['e2']);
});

test('date mode: fixture.round null groups by the same local calendar day, ignoring round', () => {
  const self = fx('e1', { round: null, kickoff: '2026-08-22T09:00:00Z' });
  const sameDayLater = fx('e2', { round: null, kickoff: '2026-08-22T18:00:00Z' });
  const differentDay = fx('e3', { round: null, kickoff: '2026-08-23T09:00:00Z' });
  const out = siblingFixtures([self, sameDayLater, differentDay], self);
  expect(out.map(f => f.id)).toEqual(['e2']);
});

test('excludes the fixture itself even when it would otherwise match its own round', () => {
  const self = fx('e1', { round: 'final' });
  const out = siblingFixtures([self], self);
  expect(out).toEqual([]);
});

test('excludes fixtures from a different competition', () => {
  const self = fx('e1', { compId: 'sco.1', round: null, kickoff: '2026-08-22T09:00:00Z' });
  const otherComp = fx('e2', { compId: 'sco.cis', round: null, kickoff: '2026-08-22T09:00:00Z' });
  const out = siblingFixtures([self, otherComp], self);
  expect(out).toEqual([]);
});

test('results are sorted by kickoff, earliest first', () => {
  const self = fx('e1', { round: 'final', kickoff: '2026-08-22T14:00:00Z' });
  const later = fx('e2', { round: 'final', kickoff: '2026-08-22T20:00:00Z' });
  const earlier = fx('e3', { round: 'final', kickoff: '2026-08-22T12:00:00Z' });
  const out = siblingFixtures([self, later, earlier], self);
  expect(out.map(f => f.id)).toEqual(['e3', 'e2']);
});

test('caps at the limit (default 8)', () => {
  const self = fx('e1', { round: 'final' });
  const rest = Array.from({ length: 10 }, (_, i) =>
    fx(`s${i}`, { round: 'final', kickoff: `2026-08-22T${String(10 + i).padStart(2, '0')}:00:00Z` }));
  const out = siblingFixtures([self, ...rest], self);
  expect(out).toHaveLength(8);
  expect(out.map(f => f.id)).toEqual(['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']);
});

test('a custom limit is honoured', () => {
  const self = fx('e1', { round: 'final' });
  const rest = Array.from({ length: 5 }, (_, i) =>
    fx(`s${i}`, { round: 'final', kickoff: `2026-08-22T${String(10 + i).padStart(2, '0')}:00:00Z` }));
  const out = siblingFixtures([self, ...rest], self, 2);
  expect(out.map(f => f.id)).toEqual(['s0', 's1']);
});

test('empty-safe: an empty fixtures list returns an empty array', () => {
  const self = fx('e1', { round: 'final' });
  expect(siblingFixtures([], self)).toEqual([]);
});
