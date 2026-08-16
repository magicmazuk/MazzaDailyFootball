import { upcomingTv } from './onTv.js';

const fx = (id, kickoff, tv, status = 'scheduled') =>
  ({ id, kickoff, status, tv, home: { teamId: id }, away: { teamId: 'x' } });
const now = new Date('2026-08-14T12:00:00Z');

test('scheduled + televised + within 14 days, soonest first', () => {
  const out = upcomingTv([
    fx('late', '2026-09-05T19:00:00Z', ['Sky Sports']),   // beyond 14 days
    fx('b', '2026-08-22T16:45:00Z', ['Premier Sports']),
    fx('a', '2026-08-21T19:00:00Z', ['Sky Sports']),
    fx('none', '2026-08-22T14:00:00Z', []),
    fx('done', '2026-08-13T19:00:00Z', ['Sky Sports'], 'ft'),
  ], now);
  expect(out.map(f => f.id)).toEqual(['a', 'b']);
});

test('caps at eight', () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    fx(String(i), `2026-08-${15 + i}T14:00:00Z`, ['BBC']));
  expect(upcomingTv(many, now)).toHaveLength(8);
});

// --- window starts tomorrow, not now (backlog, spec §13.18.4): a fixture
// kicking off later today is already shown under Live/Later today — On TV
// must not duplicate it. ---

test('a fixture kicking off later today is excluded; one kicking off tomorrow is included', () => {
  const laterToday = fx('lt', '2026-08-14T20:00:00Z', ['Sky Sports']); // same local day as `now`
  const tomorrow = fx('tm', '2026-08-15T10:00:00Z', ['Sky Sports']);
  const out = upcomingTv([laterToday, tomorrow], now);
  expect(out.map(f => f.id)).toEqual(['tm']);
});
