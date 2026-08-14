import { dayKey, monthGrid, addMonths, fixturesByDay } from './calendar.js';

test('dayKey uses local date parts, zero-padded', () => {
  expect(dayKey(new Date(2026, 7, 3))).toBe('2026-08-03');
  expect(dayKey(new Date(2026, 11, 25))).toBe('2026-12-25');
});

test('August 2026 grid: Monday-first, starts 27 July, 6 weeks', () => {
  const weeks = monthGrid(2026, 7); // August (0-based)
  expect(weeks).toHaveLength(6);
  expect(weeks[0][0].getDay()).toBe(1); // Monday
  expect(dayKey(weeks[0][0])).toBe('2026-07-27');
  expect(dayKey(weeks[5][6])).toBe('2026-09-06');
  // 1 August 2026 is a Saturday — position 5 of week 0
  expect(dayKey(weeks[0][5])).toBe('2026-08-01');
});

test('February 2027 grid: starts on Monday the 1st, exactly 4 weeks', () => {
  const weeks = monthGrid(2027, 1);
  expect(weeks).toHaveLength(4);
  expect(dayKey(weeks[0][0])).toBe('2027-02-01');
  expect(dayKey(weeks[3][6])).toBe('2027-02-28');
});

test('addMonths rolls the year both ways', () => {
  expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  expect(addMonths({ year: 2026, month: 7 }, 1)).toEqual({ year: 2026, month: 8 });
});

test('fixturesByDay groups by local kickoff date and sorts within the day', () => {
  const f = (id, kickoff) => ({ id, kickoff });
  const map = fixturesByDay([
    f('b', '2026-08-22T16:45:00Z'),
    f('a', '2026-08-22T14:00:00Z'),
    f('c', '2026-08-23T13:00:00Z'),
  ]);
  const key = dayKey(new Date('2026-08-22T14:00:00Z'));
  expect(map.get(key).map(x => x.id)).toEqual(['a', 'b']);
  expect(map.size).toBe(2);
});
