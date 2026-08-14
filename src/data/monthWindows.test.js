import { monthWindows } from './queries.js';

test('a full season splits into one window per calendar month', () => {
  const windows = monthWindows('2026-07-01', '2027-06-30');
  expect(windows).toHaveLength(12);
  expect(windows[0]).toEqual({ start: '2026-07-01', end: '2026-07-31' });
  expect(windows[11]).toEqual({ start: '2027-06-01', end: '2027-06-30' });
});

test('month boundaries are correct, including February in a non-leap year', () => {
  const windows = monthWindows('2026-07-01', '2027-06-30');
  const byMonth = Object.fromEntries(windows.map(w => [w.start.slice(0, 7), w]));
  expect(byMonth['2027-02']).toEqual({ start: '2027-02-01', end: '2027-02-28' });
  expect(byMonth['2026-09']).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  expect(byMonth['2026-12']).toEqual({ start: '2026-12-01', end: '2026-12-31' });
});

test('every window starts on the 1st and never spans two months', () => {
  const windows = monthWindows('2026-07-01', '2027-06-30');
  for (const w of windows) {
    expect(w.start.endsWith('-01')).toBe(true);
    expect(w.start.slice(0, 7)).toBe(w.end.slice(0, 7));
  }
});

test('a single-month range yields exactly one window', () => {
  expect(monthWindows('2026-08-01', '2026-08-31')).toEqual([
    { start: '2026-08-01', end: '2026-08-31' },
  ]);
});
