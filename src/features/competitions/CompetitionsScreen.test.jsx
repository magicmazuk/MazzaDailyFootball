// Motion (spec §13.21): the page's sections rise in on mount; §13.34 put
// the two headline tables and the elsewhere desk ABOVE the country
// groups, so the stagger order migrated with the layout.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { usePrefs } from '../../store/prefs.js';
import { COMPETITIONS } from '../../domain/competitions.js';

// The front page reads two tables and every season's fixtures — all from
// caches shared app-wide; mocked here at the queries seam.
vi.mock('../../data/queries.js', () => ({
  useTable: vi.fn(),
  useAllSeasonFixtures: vi.fn(),
}));
import { useTable, useAllSeasonFixtures } from '../../data/queries.js';
import CompetitionsScreen from './CompetitionsScreen.jsx';

const tableRow = (position, name, points) => ({
  teamId: name, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase(),
  position, points, played: 2 });
const tables = {
  'sco.1': [tableRow(1, 'Celtic', 6), tableRow(2, 'St Mirren', 6)],
  'eng.1': [tableRow(1, 'Arsenal', 3), tableRow(2, 'Man City', 3)],
};

beforeEach(() => {
  usePrefs.setState({ hiddenComps: [] });
  useTable.mockImplementation(comp => ({
    data: tables[comp.id] ? { rows: tables[comp.id] } : undefined,
    isLoading: false, isError: false,
  }));
  useAllSeasonFixtures.mockReturnValue(
    COMPETITIONS.filter(c => c.id !== 'sco.1' && c.id !== 'eng.1').map(c => ({
      data: c.id === 'uefa.champions'
        ? { fixtures: [{ id: 'q', status: 'scheduled', round: 'playoff-round',
            kickoff: new Date(Date.now() + 86400000).toISOString() }] }
        : { fixtures: [] },
    })),
  );
});

test('the two headline tables print every row with a full-table link each', () => {
  render(<MemoryRouter><CompetitionsScreen /></MemoryRouter>);
  expect(screen.getByText('Celtic')).toBeInTheDocument();
  expect(screen.getByText('St Mirren')).toBeInTheDocument();
  expect(screen.getByText('Arsenal')).toBeInTheDocument();
  const links = screen.getAllByRole('link', { name: /Full table/ });
  expect(links.map(l => l.getAttribute('href')))
    .toEqual(['/competition/sco.1', '/competition/eng.1']);
});

test('a headline row navigates to its club page', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<CompetitionsScreen />} />
        <Route path="/team/:compId/:teamId" element={<p>club stub</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await user.click(screen.getByText('Celtic'));
  expect(screen.getByText('club stub')).toBeInTheDocument();
});

test('the elsewhere desk lists only competitions with an active summary, linking through', () => {
  render(<MemoryRouter><CompetitionsScreen /></MemoryRouter>);
  // The desk is a status line; the list below stays the canonical index —
  // a summarised cup appears in BOTH by design, so queries scope to the desk.
  const desk = screen.getByText('In play elsewhere').closest('section');
  const cl = within(desk).getByText('UEFA Champions League').closest('a');
  expect(cl.getAttribute('href')).toBe('/competition/uefa.champions');
  expect(cl.textContent).toContain('Play-off round');
  // A comp with no upcoming fixtures gets no summary line — it lives in
  // the list alone (FA Cup mocked empty above).
  expect(within(desk).queryByText('FA Cup')).not.toBeInTheDocument();
  expect(screen.getByText('FA Cup').closest('a').getAttribute('href')).toBe('/competition/eng.fa');
});

test('the list keeps its country groups but drops the two headliners', () => {
  render(<MemoryRouter><CompetitionsScreen /></MemoryRouter>);
  expect(screen.getByText('Scotland')).toBeInTheDocument();
  expect(screen.getByText('England')).toBeInTheDocument();
  expect(screen.getByText('Europe')).toBeInTheDocument();
  expect(screen.queryByText('Scottish Premiership')).not.toBeInTheDocument();
  expect(screen.queryByText('English Premier League')).not.toBeInTheDocument();
  expect(screen.getByText('Scottish Championship')).toBeInTheDocument();
});

test('a hidden competition is omitted, and a country with nothing left drops its section', () => {
  const european = COMPETITIONS.filter(c => c.country === 'Europe').map(c => c.id);
  usePrefs.setState({ hiddenComps: european });
  render(<MemoryRouter><CompetitionsScreen /></MemoryRouter>);
  expect(screen.queryByText('Europe')).not.toBeInTheDocument();
});
