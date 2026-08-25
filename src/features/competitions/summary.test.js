import { expect, test } from 'vitest';
import { activeSummary } from './summary.js';

const NOW = new Date('2026-08-25T12:00:00Z');
const fx = (over = {}) => ({
  id: 'x', status: 'scheduled', kickoff: '2026-08-26T19:00:00Z', round: 'playoff-round', ...over,
});

test('a live fixture summarises as LIVE with its round', () => {
  const s = activeSummary([fx({ status: 'live' })], NOW);
  expect(s).toEqual({ live: true, text: 'Live · Play-off round' });
});

test('a live league fixture (no real round) is just Live', () => {
  const s = activeSummary([fx({ status: 'live', round: '2026-27-scottish-premiership' })], NOW);
  expect(s).toEqual({ live: true, text: 'Live' });
});

test('the nearest upcoming round within a fortnight names itself and its day', () => {
  const s = activeSummary([
    fx({ kickoff: '2026-09-20T14:00:00Z' }),                      // beyond the window
    fx({ id: 'soon', kickoff: '2026-08-26T19:00:00Z' }),          // Wednesday
  ], NOW);
  expect(s).toEqual({ live: false, text: 'Play-off round · Wed 26 Aug' });
});

test('a league summary is day-only — no phantom round from the season slug', () => {
  const s = activeSummary([
    fx({ round: '2026-27-wosfl', kickoff: '2026-08-29T13:00:00Z' }),
  ], NOW);
  expect(s).toEqual({ live: false, text: 'Sat 29 Aug' });
});

test('nothing live and nothing within a fortnight means no summary at all', () => {
  expect(activeSummary([fx({ kickoff: '2026-09-20T14:00:00Z' })], NOW)).toBeNull();
  expect(activeSummary([fx({ status: 'ft', kickoff: '2026-08-20T14:00:00Z' })], NOW)).toBeNull();
  expect(activeSummary([], NOW)).toBeNull();
  expect(activeSummary(undefined, NOW)).toBeNull();
});

test('postponed fixtures never anchor a summary', () => {
  expect(activeSummary([fx({ status: 'postponed' })], NOW)).toBeNull();
});
