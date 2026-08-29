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
