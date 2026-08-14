import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import MonthGrid from './MonthGrid.jsx';
import { monthGrid, fixturesByDay, dayKey } from '../../domain/calendar.js';

const side = (teamId, name) => ({ teamId, name, crestUrl: null,
  monogram: name.slice(0, 2).toUpperCase(), score: null });
const fx = (id, kickoff, h, hn, a, an) => ({ id, compId: 'sco.1', kickoff,
  status: 'scheduled', tv: [], home: side(h, hn), away: side(a, an) });

const weeks = monthGrid(2026, 7);
const fixtures = [
  fx('1', '2026-08-22T14:00:00Z', '256', 'Celtic', '267', 'St Johnstone'),
  fx('2', '2026-08-22T16:45:00Z', '264', 'Dundee United', '261', 'Dundee'),
  fx('3', '2026-08-25T18:45:00Z', '254', 'Falkirk', '250', 'St Mirren'),
];

test('general mode: crests appear on playing days, followed club first', () => {
  render(<MonthGrid weeks={weeks} monthIndex={7} byDay={fixturesByDay(fixtures)}
    followedIds={new Set(['256'])} clubId={null} selectedKey={null}
    onSelectDay={() => {}} todayKey="2026-08-14" />);
  // Aug 22 cell carries Celtic's monogram (followed → own crest) and Dundee Utd's (home crest)
  expect(screen.getByText('CE')).toBeInTheDocument();
  expect(screen.getByText('DU')).toBeInTheDocument();
  // Aug 25 carries Falkirk (home)
  expect(screen.getByText('FA')).toBeInTheDocument();
});

test('club mode: the opponent crest shows on the playing day', () => {
  render(<MonthGrid weeks={weeks} monthIndex={7}
    byDay={fixturesByDay(fixtures.filter(f => f.home.teamId === '256' || f.away.teamId === '256'))}
    followedIds={new Set(['256'])} clubId="256" selectedKey={null}
    onSelectDay={() => {}} todayKey="2026-08-14" />);
  expect(screen.getByText('ST')).toBeInTheDocument();   // St Johnstone, the opponent
  expect(screen.queryByText('CE')).toBeNull();          // never the club's own crest
});

test('tapping a day reports its key', async () => {
  const user = userEvent.setup();
  const onSelectDay = vi.fn();
  render(<MonthGrid weeks={weeks} monthIndex={7} byDay={new Map()}
    followedIds={new Set()} clubId={null} selectedKey={null}
    onSelectDay={onSelectDay} todayKey="2026-08-14" />);
  await user.click(screen.getByRole('button', { name: /22 August/ }));
  expect(onSelectDay).toHaveBeenCalledWith('2026-08-22');
});

test('overflow shows +n beyond three fixtures', () => {
  const many = ['1', '2', '3', '4', '5'].map(n =>
    fx(n, '2026-08-22T14:00:00Z', 'h' + n, 'Team' + n, 'a' + n, 'Away' + n));
  render(<MonthGrid weeks={weeks} monthIndex={7} byDay={fixturesByDay(many)}
    followedIds={new Set()} clubId={null} selectedKey={null}
    onSelectDay={() => {}} todayKey="2026-08-14" />);
  expect(screen.getByText('+2')).toBeInTheDocument();
});
