import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LeagueTable from './LeagueTable.jsx';
import { byId } from '../../domain/competitions.js';

const row = (position, name, over = {}) => ({
  teamId: name, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase(),
  position, played: 38, won: 24, drawn: 8, lost: 6, goalsFor: 67, goalsAgainst: 34,
  goalDifference: 33, points: 80, deduction: 0, ...over,
});
const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, 'Team' + (i + 1)));

test('tap a row to open its record; tap again to close', async () => {
  const { container } = render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{ Team2: ['W', 'W', 'D', 'W', 'L'] }} />
  </MemoryRouter>);
  expect(screen.queryByText('GF')).toBeNull();
  await userEvent.click(screen.getByText('Team2'));
  expect(screen.getByText('GF')).toBeInTheDocument();
  expect(screen.getByText('67')).toBeInTheDocument(); // goals for in the drawer
  await userEvent.click(screen.getByText('Team2'));
  // Content stays mounted (clipped to height 0 by Collapse) rather than
  // unmounting, so the close glide has real content to shut around
  // instead of an already-empty box (fix round 1, HIGH).
  expect(screen.getByText('GF')).toBeInTheDocument();
  const collapses = [...container.querySelectorAll('.collapse-glide')];
  const closed = collapses.find(el => within(el).queryByText('GF'));
  expect(closed.style.height).toBe('0px');
});

test('the split renders after 6th in the Premiership and a deduction is stated', async () => {
  const withDeduction = rows.map(r =>
    r.position === 8 ? { ...r, deduction: -5 } : r);
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={withDeduction} followedIds={new Set()}
      formByTeam={{}} />
  </MemoryRouter>);
  expect(screen.getByText('The split')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Team8'));
  expect(screen.getByText('5-point deduction applied')).toBeInTheDocument();
});

test('no split line for competitions without one', () => {
  render(<MemoryRouter>
    <LeagueTable comp={byId('eng.1')} rows={rows} followedIds={new Set()} formByTeam={{}} />
  </MemoryRouter>);
  expect(screen.queryByText('The split')).toBeNull();
});

test('followed club carries its star', () => {
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set(['Team3'])}
      formByTeam={{}} />
  </MemoryRouter>);
  expect(screen.getByText('★')).toBeInTheDocument();
});

// --- table movement (rankChange, spec §13.16) ---

test('a positive rankChange renders an up glyph with an accessible label', () => {
  const moved = rows.map(r => (r.teamId === 'Team2' ? { ...r, rankChange: 3 } : r));
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={moved} followedIds={new Set()} formByTeam={{}} />
  </MemoryRouter>);
  expect(screen.getByText('▲3')).toBeInTheDocument();
  expect(screen.getByLabelText('up 3')).toBeInTheDocument();
});

test('a negative rankChange renders a down glyph with an accessible label', () => {
  const moved = rows.map(r => (r.teamId === 'Team2' ? { ...r, rankChange: -2 } : r));
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={moved} followedIds={new Set()} formByTeam={{}} />
  </MemoryRouter>);
  expect(screen.getByText('▼2')).toBeInTheDocument();
  expect(screen.getByLabelText('down 2')).toBeInTheDocument();
});

test('a zero or missing rankChange renders no glyph', () => {
  const withZero = rows.map(r => (r.teamId === 'Team2' ? { ...r, rankChange: 0 } : r));
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={withZero} followedIds={new Set()} formByTeam={{}} />
  </MemoryRouter>);
  expect(screen.queryByText(/▲|▼/)).not.toBeInTheDocument();
});

// --- motion (spec §13.21): the drawer glides via Collapse. Its data is
// already props (no fetch), so it must never show a skeleton — it opens
// straight to content. ---

test('the drawer renders inside a Collapse (collapse-glide) and never shows a skeleton — its data is already props, no fetch', async () => {
  const { container } = render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{ Team2: ['W', 'W', 'D', 'W', 'L'] }} />
  </MemoryRouter>);

  await userEvent.click(screen.getByText('Team2'));

  // Every row carries its own Collapse (open or closed) — find the one
  // that actually opened, rather than assuming the first in DOM order.
  const collapses = [...container.querySelectorAll('.collapse-glide')];
  const open = collapses.find(el => within(el).queryByText('GF'));
  expect(open).toBeTruthy();
  expect(container.querySelectorAll('.skeleton-pulse')).toHaveLength(0);
});
