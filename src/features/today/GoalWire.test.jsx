import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import GoalWire, { poolGoals } from './GoalWire.jsx';

const live = (id, home, hs, away, as_, kickoff, goals) => ({
  id, compId: 'sco.1', status: 'live', kickoff,
  home: { teamId: `${id}h`, name: home, score: hs },
  away: { teamId: `${id}a`, name: away, score: as_ },
  goals,
});

const CARD = [
  live('m1', 'Celtic', 1, 'Falkirk', 0, '2026-08-29T14:00:00Z', [
    { minute: "4'", clockValue: 240, scorer: 'Camilo Durán', teamId: 'm1h', ownGoal: false, penalty: false },
  ]),
  live('m2', 'Hearts', 1, 'St Johnstone', 0, '2026-08-29T14:00:00Z', [
    { minute: "9'", clockValue: 540, scorer: 'James Wilson', teamId: 'm2h', ownGoal: false, penalty: false },
  ]),
  live('m3', 'Kilmarnock', 0, 'Dundee United', 1, '2026-08-29T14:00:00Z', [
    { minute: "12'", clockValue: 720, scorer: null, teamId: 'm3a', ownGoal: false, penalty: false },
  ]),
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('poolGoals orders by real time (kickoff + clock), newest first, capped at six', () => {
  const late = live('m4', 'Aberdeen', 1, 'Hibernian', 0, '2026-08-29T16:00:00Z', [
    { minute: "2'", clockValue: 120, scorer: 'A Body', teamId: 'm4h', ownGoal: false, penalty: false },
  ]);
  const pool = poolGoals([...CARD, late]);
  // the 16:00 kickoff's 2′ goal is the newest thing on the wire
  expect(pool[0].fixture.id).toBe('m4');
  expect(pool[1].goal.minute).toBe("12'");
  expect(poolGoals([
    live('m5', 'A', 9, 'B', 0, '2026-08-29T14:00:00Z',
      Array.from({ length: 9 }, (_, i) => (
        { minute: `${i + 1}'`, clockValue: (i + 1) * 60, scorer: null, teamId: 'x', ownGoal: false, penalty: false }))),
  ])).toHaveLength(6);
});

test('the wire shows the newest goal with the GOAL mark, the line, scorer and prime', () => {
  render(<MemoryRouter><GoalWire fixtures={CARD} /></MemoryRouter>);
  expect(screen.getByText('GOAL')).toHaveClass('font-sans', 'text-[8.5px]', 'text-accent');
  // newest = the 12′ Kilmarnock goal — scorerless, so minute alone, no dash
  expect(screen.getByText('Kilmarnock 0 Dundee United 1')).toBeInTheDocument();
  expect(screen.getByText('12′')).toBeInTheDocument();
  // whole line doors into the match
  expect(screen.getByRole('link')).toHaveAttribute('href', '/match/sco.1/m3');
  // dots count the pool, first active
  expect(document.querySelectorAll('[data-testid="wire-dot"]')).toHaveLength(3);
});

test('the rotation advances on the interval and wraps', () => {
  render(<MemoryRouter><GoalWire fixtures={CARD} /></MemoryRouter>);
  act(() => { vi.advanceTimersByTime(6000); });
  expect(screen.getByText(/Wilson 9′/)).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(6000); });
  expect(screen.getByText(/Durán 4′/)).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(6000); });
  expect(screen.getByText('12′')).toBeInTheDocument();
});

test('a single goal shows no dots and never rotates; no goals or no live means no wire at all', () => {
  const { container, rerender } = render(<MemoryRouter><GoalWire fixtures={[CARD[0]]} /></MemoryRouter>);
  expect(document.querySelectorAll('[data-testid="wire-dot"]')).toHaveLength(0);
  rerender(<MemoryRouter><GoalWire fixtures={[{ ...CARD[0], goals: [] }]} /></MemoryRouter>);
  expect(container.innerHTML).toBe('');
  rerender(<MemoryRouter><GoalWire fixtures={[]} /></MemoryRouter>);
  expect(container.innerHTML).toBe('');
});

// --- the stack (T-B), the wire's second form (spec §13.44 addendum) ---

test('stack mode prints the latest goals as rows, newest first, capped at four, no dots, no timer', () => {
  const busy = [...CARD,
    live('m6', 'Aberdeen', 2, 'Ross County', 0, '2026-08-29T14:00:00Z', [
      { minute: "15'", clockValue: 900, scorer: 'One Player', teamId: 'm6h', ownGoal: false, penalty: false },
      { minute: "18'", clockValue: 1080, scorer: 'Two Player', teamId: 'm6h', ownGoal: false, penalty: false },
    ])];
  render(<MemoryRouter><GoalWire fixtures={busy} mode="stack" /></MemoryRouter>);
  const rows = screen.getAllByTestId('wire-row');
  expect(rows).toHaveLength(4);
  expect(rows[0].textContent).toContain('18′');
  expect(rows[0].textContent).toContain('Player');
  expect(rows[3].textContent).toContain('9′');
  expect(document.querySelectorAll('[data-testid="wire-dot"]')).toHaveLength(0);
  act(() => { vi.advanceTimersByTime(12000); });
  expect(screen.getAllByTestId('wire-row')[0].textContent).toContain('18′');
  // each row doors into its match
  expect(rows[0].closest('a')).toHaveAttribute('href', '/match/sco.1/m6');
});

test('a scorerless goal in the stack prints minute alone — never a dash of guesswork', () => {
  render(<MemoryRouter><GoalWire fixtures={[CARD[2]]} mode="stack" /></MemoryRouter>);
  const row = screen.getByTestId('wire-row');
  expect(row.textContent).toContain('12′');
  expect(row.textContent).toContain('Kilmarnock 0 Dundee United 1');
});

// --- the goalflash (spec §13.44 addendum): arrivals flash, departures fade ---

test('a NEW goal arriving in stack mode wears the flash; the initial render never flashes', () => {
  const { rerender } = render(<MemoryRouter><GoalWire fixtures={CARD} mode="stack" /></MemoryRouter>);
  screen.getAllByTestId('wire-row').forEach(r => expect(r.className).not.toContain('wire-flash'));
  const withNew = [...CARD.slice(0, 2), { ...CARD[2], goals: [...CARD[2].goals,
    { minute: "31'", clockValue: 1860, scorer: 'New Man', teamId: 'm3a', ownGoal: false, penalty: false }] }];
  rerender(<MemoryRouter><GoalWire fixtures={withNew} mode="stack" /></MemoryRouter>);
  const rows = screen.getAllByTestId('wire-row');
  expect(rows[0].textContent).toContain('31′');
  expect(rows[0].className).toContain('wire-flash');
  expect(rows[1].className).not.toContain('wire-flash');
});

test('the goal pushed off the stack lingers with wire-leave, then departs on the timer', () => {
  const four = [...CARD, live('m6', 'Aberdeen', 1, 'Ross County', 0, '2026-08-29T14:00:00Z', [
    { minute: "15'", clockValue: 900, scorer: 'A', teamId: 'm6h', ownGoal: false, penalty: false },
  ])];
  const { rerender } = render(<MemoryRouter><GoalWire fixtures={four} mode="stack" /></MemoryRouter>);
  expect(screen.getAllByTestId('wire-row')).toHaveLength(4);
  const five = [...four.slice(0, 3), { ...four[3], goals: [...four[3].goals,
    { minute: "40'", clockValue: 2400, scorer: 'B', teamId: 'm6h', ownGoal: false, penalty: false }] }];
  rerender(<MemoryRouter><GoalWire fixtures={five} mode="stack" /></MemoryRouter>);
  const rows = screen.getAllByTestId('wire-row');
  expect(rows).toHaveLength(5);
  const leaver = rows.find(r => r.className.includes('wire-leave'));
  expect(leaver.textContent).toContain('4′');
  act(() => { vi.advanceTimersByTime(600); });
  expect(screen.getAllByTestId('wire-row')).toHaveLength(4);
  expect(screen.queryByText('4′')).not.toBeInTheDocument();
});

test('in line mode a new goal seizes the line with the flash and resets the rotation', () => {
  const { rerender } = render(<MemoryRouter><GoalWire fixtures={CARD} /></MemoryRouter>);
  act(() => { vi.advanceTimersByTime(6000); });
  expect(screen.getByText(/Wilson 9′/)).toBeInTheDocument();
  const withNew = [...CARD.slice(0, 2), { ...CARD[2], goals: [...CARD[2].goals,
    { minute: "31'", clockValue: 1860, scorer: 'New Man', teamId: 'm3a', ownGoal: false, penalty: false }] }];
  rerender(<MemoryRouter><GoalWire fixtures={withNew} /></MemoryRouter>);
  expect(screen.getByText(/Man 31′/)).toBeInTheDocument();
  expect(document.querySelector('.wire-flash')).not.toBeNull();
});
