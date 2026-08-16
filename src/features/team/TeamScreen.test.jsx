// Cheap wiring assertions for the team page's replay-the-draw link (spec
// §13.15) — the pure grouping logic lives in teamFixtures.js
// (phaseReplayGroups), tested directly there; this file only checks
// TeamScreen renders what that returns, in the Season section header area.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { usePrefs, CELTIC } from '../../store/prefs.js';

vi.mock('../../data/queries.js', () => ({
  useTeams: vi.fn(() => ({ isLoading: false, data: undefined })),
  useAllSeasonFixtures: vi.fn(() => []),
  useSquad: vi.fn(() => ({ isLoading: false, isError: false, data: undefined })),
}));

import TeamScreen from './TeamScreen.jsx';
import { useTeams, useAllSeasonFixtures, useSquad } from '../../data/queries.js';

const side = (teamId, name) => ({ teamId, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase() });
const fx = (id, compId, round, kickoff, home, away, status = 'scheduled') =>
  ({ id, compId, kickoff, status, minute: null, round, venue: null, home, away });

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({ followed: { [CELTIC.id]: CELTIC } });
  useTeams.mockImplementation(() => ({ isLoading: false, data: undefined }));
  useSquad.mockImplementation(() => ({ isLoading: false, isError: false, data: undefined }));
  useAllSeasonFixtures.mockImplementation(() => []);
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

// --- squad rows link to the player page (spec §13.16) ---

test('a squad row is a whole-row link to the player page, carrying the club name as router state', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' }] },
  }));

  renderAt('sco.1', '256');

  const link = screen.getByRole('link', { name: /Kasper Høgh/ });
  expect(link).toHaveAttribute('href', '/player/sco.1/p1');
});

// --- home-league hotfix (Aug 2026): useSquad resolves squads under a
// fallback league and reports resolvedCompId; the row link and the
// "still empty after resolving" state both key off that. ---

test('a squad row links to the player page under the resolved league, not the route comp, when they differ', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'uefa.champions': [fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' }], resolvedCompId: 'sco.1' },
  }));

  renderAt('uefa.champions', '256');

  const link = screen.getByRole('link', { name: /Kasper Høgh/ });
  expect(link).toHaveAttribute('href', '/player/sco.1/p1');
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

test('a club with no phase fixtures at all renders the page normally, no replay link', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  renderAt('sco.1', '256');
  expect(screen.queryByRole('link', { name: /Replay the/ })).not.toBeInTheDocument();
  expect(screen.getByText('Season')).toBeInTheDocument();
});
