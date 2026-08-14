// Calendar math (spec §13.5). All day keys are LOCAL dates, matching
// partitionToday's local-day semantics. Weeks start Monday.
const pad = n => String(n).padStart(2, '0');

export const dayKey = d => {
  const date = new Date(d);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Monday-first grid of full weeks covering the given month.
export function monthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // back to Monday
  const weeks = [];
  const cursor = new Date(start);
  do {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getMonth() === monthIndex && cursor.getFullYear() === year);
  return weeks;
}

export function addMonths({ year, month }, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function fixturesByDay(fixtures) {
  const map = new Map();
  for (const f of fixtures) {
    const key = dayKey(f.kickoff);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  }
  return map;
}
