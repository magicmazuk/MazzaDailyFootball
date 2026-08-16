// Cheap wiring assertions for the team page's replay-the-draw link (spec
// §13.15) — the pure grouping logic lives in teamFixtures.js
// (phaseReplayGroups), tested directly there; this file only checks
// TeamScreen renders what that returns, in the Season section header area.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest'; // vi.mock() hoisting needs vi imported this way, not the ambient global
import { usePrefs, CELTIC } from '../../store/prefs.js';

// PlayerSheet (mounted at TeamScreen's root, sheet-first consistency,
// Aug 2026) fetches via usePlayer internally — mocked here the same way
// MatchRoom.test.jsx mocks it, so these tests don't need a
// QueryClientProvider.
vi.mock('../../data/queries.js', () => ({
  useTeams: vi.fn(() => ({ isLoading: false, data: undefined })),
  useAllSeasonFixtures: vi.fn(() => []),
  useSquad: vi.fn(() => ({ isLoading: false, isError: false, data: undefined })),
  usePlayer: vi.fn(() => ({ bio: null, stats: null, isLoading: false, isError: false })),
}));

import TeamScreen from './TeamScreen.jsx';
import { useTeams, useAllSeasonFixtures, useSquad, usePlayer } from '../../data/queries.js';

const side = (teamId, name, over = {}) =>
  ({ teamId, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase(), colour: null, ...over });
const fx = (id, compId, round, kickoff, home, away, status = 'scheduled') =>
  ({ id, compId, kickoff, status, minute: null, round, venue: null, home, away });

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({ followed: { [CELTIC.id]: CELTIC } });
  useTeams.mockImplementation(() => ({ isLoading: false, data: undefined }));
  useSquad.mockImplementation(() => ({ isLoading: false, isError: false, data: undefined }));
  useAllSeasonFixtures.mockImplementation(() => []);
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: false });
});

// Feeds every one of the 13 registry comps a fixture list (default empty)
// keyed by compId — TeamScreen queries useAllSeasonFixtures(COMPETITIONS),
// so every comp needs a settled result, not just the one under test.
function stubSeasons(fixturesByCompId) {
  useAllSeasonFixtures.mockImplementation(comps => comps.map(c => ({
    isLoading: false, isSuccess: true, isError: false,
    data: { fixtures: fixturesByCompId[c.id] ?? [], asOf: null },
  })));
}

function renderAt(compId, teamId) {
  return render(
    <MemoryRouter initialEntries={[`/team/${compId}/${teamId}`]}>
      <Routes>
        <Route path="team/:compId/:teamId" element={<TeamScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

test('a club with 2+ phase-round fixtures in a comp gets a replay link to the opponents draw route', () => {
  const celtic = side('256', 'Celtic');
  const fixtures = [
    fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    fx('f2', 'uefa.champions', 'league-phase', '2026-09-02T15:00:00Z', side('o2', 'Opponent 2'), celtic),
  ];
  stubSeasons({ 'uefa.champions': fixtures });

  renderAt('uefa.champions', '256');

  expect(screen.getByRole('link', { name: 'Replay the League Phase draw' }))
    .toHaveAttribute('href', '/draw/uefa.champions/league-phase/256');
});

test('a club with only 1 phase-round fixture gets no replay link', () => {
  const celtic = side('256', 'Celtic');
  const fixtures = [
    fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
  ];
  stubSeasons({ 'uefa.champions': fixtures });

  renderAt('uefa.champions', '256');

  expect(screen.queryByRole('link', { name: /Replay the/ })).not.toBeInTheDocument();
});

test('a club with no phase-round fixtures (only knockout ones) gets no replay link', () => {
  const celtic = side('256', 'Celtic');
  const fixtures = [
    fx('f1', 'sco.tennents', 'fourth-round', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    fx('f2', 'sco.tennents', 'fifth-round', '2026-09-08T15:00:00Z', celtic, side('o2', 'Opponent 2')),
  ];
  stubSeasons({ 'sco.tennents': fixtures });

  renderAt('sco.tennents', '256');

  expect(screen.queryByRole('link', { name: /Replay the/ })).not.toBeInTheDocument();
});

test('a club with qualifying phase fixtures in two comps gets one replay link each', () => {
  const celtic = side('256', 'Celtic');
  const championsFixtures = [
    fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    fx('f2', 'uefa.champions', 'league-phase', '2026-09-02T15:00:00Z', side('o2', 'Opponent 2'), celtic),
  ];
  const challengeFixtures = [
    fx('f3', 'sco.challenge', 'league-phase', '2026-08-01T15:00:00Z', celtic, side('o3', 'Opponent 3')),
    fx('f4', 'sco.challenge', 'league-phase', '2026-08-08T15:00:00Z', side('o4', 'Opponent 4'), celtic),
  ];
  stubSeasons({ 'uefa.champions': championsFixtures, 'sco.challenge': challengeFixtures });

  renderAt('uefa.champions', '256');

  // Two comps both resolve to the 'League Phase' label, so both links
  // share an accessible name — asserted together, each keyed off ITS OWN
  // compId in the href, even though the page itself was opened via
  // uefa.champions.
  const links = screen.getAllByRole('link', { name: 'Replay the League Phase draw' });
  expect(links.map(l => l.getAttribute('href')).sort()).toEqual([
    '/draw/sco.challenge/league-phase/256',
    '/draw/uefa.champions/league-phase/256',
  ]);
});

// --- squad rows open the player sheet (sheet-first consistency, Aug 2026):
// every player tap opens PlayerSheet; the full page is reached only via the
// sheet's "Full profile →" link (or a direct URL). ---

test('a squad row is a button (not a link) that opens the player sheet', async () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' }] },
  }));
  usePlayer.mockReturnValue({
    bio: { id: 'p1', name: 'Kasper Høgh', position: 'Forward', shirt: '9', age: 24, nationality: 'Denmark' },
    stats: { appearances: 10, minutes: 900, goals: 3 },
    isLoading: false, isError: false,
  });

  renderAt('sco.1', '256');

  expect(screen.queryByRole('link', { name: /Kasper Høgh/ })).not.toBeInTheDocument();
  const row = screen.getByRole('button', { name: 'Kasper Høgh' });

  await userEvent.click(row);

  expect(screen.getByRole('link', { name: 'Full profile →' })).toHaveAttribute('href', '/player/sco.1/p1');
});

// --- home-league hotfix (Aug 2026): useSquad resolves squads under a
// fallback league and reports resolvedCompId; the sheet's comp (and so its
// Full profile link, and the stats it fetches with) key off that, not the
// route comp. ---

test('a squad row opens the sheet under the resolved league, not the route comp, when they differ', async () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'uefa.champions': [fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' }], resolvedCompId: 'sco.1' },
  }));
  usePlayer.mockReturnValue({
    bio: { id: 'p1', name: 'Kasper Høgh', position: 'Forward', shirt: '9', age: 24, nationality: 'Denmark' },
    stats: { appearances: 10, minutes: 900, goals: 3 },
    isLoading: false, isError: false,
  });

  renderAt('uefa.champions', '256');

  await userEvent.click(screen.getByRole('button', { name: 'Kasper Høgh' }));

  expect(screen.getByRole('link', { name: 'Full profile →' })).toHaveAttribute('href', '/player/sco.1/p1');
});

test('an empty squad (resolved through every fallback, still zero players) shows the distinct unavailable line', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [], resolvedCompId: null },
  }));

  renderAt('sco.1', '256');

  expect(screen.getByText('Squad details unavailable.')).toBeInTheDocument();
  // Distinct from the BBC hasSquads:false line, which never applies here.
  expect(screen.queryByText(/aren't published for/)).not.toBeInTheDocument();
});

// --- the visual squad experiment (squad-visual branch, Aug 2026, v2): rows
// of club-coloured shirt icons grouped into pitch-order sections (v1's
// balance strip and 4-column tile grid are gone). Position bucketing keys
// off a first-letter match so it copes with both ESPN's abbreviations
// ('G'/'D'/'M'/'F') and full names alike. ---

const mixedSquad = [
  { id: 'g1', name: 'Keeper One', shirt: '1', position: 'Goalkeeper' },
  { id: 'd1', name: 'Defender One', shirt: '2', position: 'Defender' },
  { id: 'd2', name: 'Defender Two', shirt: '3', position: 'D' },
  { id: 'm1', name: 'Midfielder One', shirt: '8', position: 'Midfielder' },
  { id: 'f1', name: 'Forward One', shirt: '9', position: 'Forward' },
  { id: 'f2', name: 'Forward Two', shirt: null, position: 'F' },
  { id: 'x1', name: 'Mystery Player', shirt: '99', position: null },
];

test('a mixed-position squad groups into pitch-order sections, unknown positions trailing as a Squad bucket', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({ isLoading: false, isError: false, data: { players: mixedSquad } }));

  renderAt('sco.1', '256');

  const groupLabels = screen.getAllByTestId(/^squad-group-/).map(el => el.textContent);
  expect(groupLabels).toEqual(['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards', 'Squad']);
});

test('a squad with no unrecognised positions renders no trailing Squad bucket', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Solo Keeper', shirt: '1', position: 'Goalkeeper' }] },
  }));

  renderAt('sco.1', '256');

  expect(screen.getByTestId('squad-group-gk')).toHaveTextContent('Goalkeepers');
  expect(screen.queryByTestId('squad-group-squad')).not.toBeInTheDocument();
});

test('a squad row is a button with a player-name aria-label, a club-coloured shirt icon, the name and its position abbrev', () => {
  const celtic = side('256', 'Celtic', { colour: '009921' });
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' },
                       { id: 'p2', name: 'No Number', shirt: null, position: 'Forward' }] },
  }));

  renderAt('sco.1', '256');

  const row = screen.getByRole('button', { name: 'Kasper Høgh' });
  expect(within(row).getByText('9')).toBeInTheDocument();
  expect(within(row).getByText('Kasper Høgh')).toBeInTheDocument();
  expect(within(row).getByText('FWD')).toBeInTheDocument();
  // the shirt fill is the CLUB's colour (team.colour), same for every row.
  expect(row.querySelector('[data-testid="shirt-shape"]')).toHaveAttribute('fill', '#009921');

  const blankRow = screen.getByRole('button', { name: 'No Number' });
  expect(within(blankRow).getByText('—')).toBeInTheDocument();
});

test('the squad section renders no leftover grid/tile classes or balance strip from the earlier design', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({ isLoading: false, isError: false, data: { players: mixedSquad } }));

  const { container } = renderAt('sco.1', '256');

  expect(container.querySelector('.grid-cols-4')).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: /Squad balance/ })).not.toBeInTheDocument();
});

test('a club with no phase fixtures at all renders the page normally, no replay link', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  renderAt('sco.1', '256');
  expect(screen.queryByRole('link', { name: /Replay the/ })).not.toBeInTheDocument();
  expect(screen.getByText('Season')).toBeInTheDocument();
});
