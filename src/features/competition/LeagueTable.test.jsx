import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

// --- the Full Table (spec §13.33): the accordion was a phone-width
// compromise, never a philosophy — the broadsheet prints the full
// classified. Toggled via props (CompetitionScreen wires the persisted
// preference); drawers rest while the full print is on.
test('full mode prints every column inline — P W D L GF GA GD Pts, no drawer needed', () => {
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{}} full onToggleFull={() => {}} />
  </MemoryRouter>);
  for (const h of ['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts']) {
    expect(screen.getByText(h)).toBeInTheDocument();
  }
  // Celtic's full record reads straight off the row (rows[0] fixture data).
  const row = screen.getByText('Team1').closest('button');
  expect(row.textContent).toContain(String(rows[0].won));
  expect(row.textContent).toContain(String(rows[0].goalsAgainst));
});

test('full mode rests the drawers — tapping a row opens nothing', async () => {
  const user = userEvent.setup();
  const { container } = render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{}} full onToggleFull={() => {}} />
  </MemoryRouter>);
  await user.click(screen.getByText('Team1'));
  expect(container.querySelector('.bg-drawer')).toBeNull();
});

test('the toggle control flips the preference both ways', async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  const { rerender } = render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{}} full={false} onToggleFull={onToggle} />
  </MemoryRouter>);
  await user.click(screen.getByRole('button', { name: 'Full table' }));
  expect(onToggle).toHaveBeenCalledOnce();
  rerender(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{}} full onToggleFull={onToggle} />
  </MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Compact table' })).toBeInTheDocument();
});

test('compact mode is untouched by the feature — points only, drawers alive', async () => {
  const user = userEvent.setup();
  const { container } = render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{}} full={false} onToggleFull={() => {}} />
  </MemoryRouter>);
  expect(screen.queryByText('GD')).not.toBeInTheDocument();
  await user.click(screen.getByText('Team1'));
  expect(container.querySelector('.bg-drawer')).not.toBeNull();
});

// --- user polish (spec §13.33): the position number crowded the zone tick
// in the full print — and order plus the tick already tell that story
// there. Full mode drops the number; compact keeps it.
test('full mode prints no position number; compact still does', () => {
  const { rerender } = render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{}} full onToggleFull={() => {}} />
  </MemoryRouter>);
  expect(screen.queryAllByTestId('table-pos')).toHaveLength(0);
  rerender(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{}} full={false} onToggleFull={() => {}} />
  </MemoryRouter>);
  expect(screen.queryAllByTestId('table-pos')).toHaveLength(12);
});

test('the zone tick keeps its distance from the crest in the full print', () => {
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{}} full onToggleFull={() => {}} />
  </MemoryRouter>);
  const tick = screen.getAllByTestId('zone-tick')[0];
  expect(tick.className).toContain('mr-1.5');
  expect(tick.className).not.toContain('-mr-1');
});

// --- full print rows link through (user request, spec §13.33): with the
// drawers resting, the row itself becomes the way to the club page.
test('tapping a full-print row navigates to the team page', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={
          <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
            formByTeam={{}} full onToggleFull={() => {}} />} />
        <Route path="/team/:compId/:teamId" element={<p>team page stub</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await user.click(screen.getByText('Team3'));
  expect(screen.getByText('team page stub')).toBeInTheDocument();
});
