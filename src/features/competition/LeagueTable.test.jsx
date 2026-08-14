import { render, screen } from '@testing-library/react';
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
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{ Team2: ['W', 'W', 'D', 'W', 'L'] }} />
  </MemoryRouter>);
  expect(screen.queryByText('GF')).toBeNull();
  await userEvent.click(screen.getByText('Team2'));
  expect(screen.getByText('GF')).toBeInTheDocument();
  expect(screen.getByText('67')).toBeInTheDocument(); // goals for in the drawer
  await userEvent.click(screen.getByText('Team2'));
  expect(screen.queryByText('GF')).toBeNull();
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
