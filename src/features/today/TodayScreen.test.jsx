import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { COMPETITIONS } from '../../domain/competitions.js';
import { usePrefs } from '../../store/prefs.js';
import { tieId } from '../../domain/draws.js';

// vi.fn()-backed so individual tests can override the default "everything
// still loading" shape below with settled data for specific comps — the
// draw-seeding/hiding tests need a cup comp's season query to have
// resolved while everything else can stay loading.
vi.mock('../../data/queries.js', () => ({
  // Mirrors useQueries({ queries: [] }) === [] when there is nothing to fetch.
  useTodayWindows: vi.fn(comps => comps.map(() => ({ isLoading: true, data: undefined }))),
  useAllSeasonFixtures: vi.fn(comps => comps.map(() =>
    ({ isLoading: true, isSuccess: false, isError: false, data: undefined }))),
  useTable: vi.fn(() => ({ isLoading: true, data: undefined })),
}));

import TodayScreen from './TodayScreen.jsx';
import { useTodayWindows, useAllSeasonFixtures, useTable } from '../../data/queries.js';

const loadingResults = comps => comps.map(() =>
  ({ isLoading: true, isSuccess: false, isError: false, data: undefined }));

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({
    followed: {}, hiddenComps: COMPETITIONS.map(c => c.id),
    seenTies: {}, seenSeeded: false,
  });
  useTodayWindows.mockImplementation(loadingResults);
  useAllSeasonFixtures.mockImplementation(loadingResults);
  useTable.mockImplementation(() => ({ isLoading: true, data: undefined }));
});

test('hiding every competition shows the normal empty day, not a permanent loading state', () => {
  render(<MemoryRouter><TodayScreen /></MemoryRouter>);
  expect(screen.getByText('No matches today.')).toBeInTheDocument();
  expect(screen.queryByText("Fetching today's football…")).not.toBeInTheDocument();
});

// --- seeding + Today-scoped hiding (spec §13.14) ---

const drawFixtures = [
  { id: 't1', compId: 'sco.tennents', kickoff: '2026-08-20T15:00:00Z', status: 'scheduled',
    round: 'fourth-round', minute: null,
    home: { teamId: 'h1', name: 'Home One', crestUrl: null, monogram: 'H1' },
    away: { teamId: 'a1', name: 'Away One', crestUrl: null, monogram: 'A1' } },
  { id: 't2', compId: 'sco.tennents', kickoff: '2026-08-20T17:00:00Z', status: 'scheduled',
    round: 'fourth-round', minute: null,
    home: { teamId: 'h2', name: 'Home Two', crestUrl: null, monogram: 'H2' },
    away: { teamId: 'a2', name: 'Away Two', crestUrl: null, monogram: 'A2' } },
];

const onlyScoTennentsVisible = () =>
  usePrefs.setState({
    hiddenComps: COMPETITIONS.filter(c => c.id !== 'sco.tennents').map(c => c.id),
  });

function stubSettledSeasons() {
  useAllSeasonFixtures.mockImplementation(comps => comps.map(c => ({
    isLoading: false, isSuccess: true, isError: false,
    data: { fixtures: c.id === 'sco.tennents' ? drawFixtures : [], asOf: null },
  })));
  useTodayWindows.mockImplementation(comps => comps.map(c => ({
    isLoading: false,
    data: { fixtures: c.id === 'sco.tennents' ? drawFixtures : [], asOf: null },
  })));
}

test('an unrevealed draw shows its invitation card and hides its fixtures from Today', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
  // seenSeeded already true (as if seeded at an earlier install) so these
  // two ties read as a genuinely new, unrevealed draw rather than getting
  // silently swallowed by first-run seeding.
  usePrefs.setState({ followed: {}, seenTies: {}, seenSeeded: true });
  onlyScoTennentsVisible();
  stubSettledSeasons();

  render(<MemoryRouter><TodayScreen /></MemoryRouter>);

  expect(screen.getByText('THE DRAW IS IN')).toBeInTheDocument();
  expect(screen.queryByText('Home One')).not.toBeInTheDocument();
  expect(screen.queryByText('Home Two')).not.toBeInTheDocument();
  vi.useRealTimers();
});

test('once its ties are marked seen, the invitation card disappears and the fixtures reappear', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
  usePrefs.setState({
    followed: {}, seenSeeded: true,
    seenTies: { [tieId('sco.tennents', 't1')]: true, [tieId('sco.tennents', 't2')]: true },
  });
  onlyScoTennentsVisible();
  stubSettledSeasons();

  render(<MemoryRouter><TodayScreen /></MemoryRouter>);

  expect(screen.queryByText('THE DRAW IS IN')).not.toBeInTheDocument();
  expect(screen.getByText('Home One')).toBeInTheDocument();
  expect(screen.getByText('Home Two')).toBeInTheDocument();
  vi.useRealTimers();
});

test('seedSeenIfEmpty is only called once every cup season query has settled, never while one is still loading', () => {
  const seedSeenIfEmpty = vi.fn();
  usePrefs.setState({
    followed: {}, seenTies: {}, seenSeeded: false, seedSeenIfEmpty,
    hiddenComps: COMPETITIONS.filter(c => !['sco.tennents', 'eng.fa'].includes(c.id)).map(c => c.id),
  });
  // sco.tennents settled, eng.fa still loading — must not seed yet.
  useAllSeasonFixtures.mockImplementation(comps => comps.map(c => (c.id === 'sco.tennents'
    ? { isLoading: false, isSuccess: true, isError: false, data: { fixtures: drawFixtures, asOf: null } }
    : { isLoading: true, isSuccess: false, isError: false, data: undefined })));
  useTodayWindows.mockImplementation(loadingResults);

  const { rerender } = render(<MemoryRouter><TodayScreen /></MemoryRouter>);
  expect(seedSeenIfEmpty).not.toHaveBeenCalled();

  // Now eng.fa settles too (empty catalogue) — every cup query has settled.
  useAllSeasonFixtures.mockImplementation(comps => comps.map(c => ({
    isLoading: false, isSuccess: true, isError: false,
    data: { fixtures: c.id === 'sco.tennents' ? drawFixtures : [], asOf: null },
  })));
  rerender(<MemoryRouter><TodayScreen /></MemoryRouter>);

  expect(seedSeenIfEmpty).toHaveBeenCalledTimes(1);
  expect(seedSeenIfEmpty).toHaveBeenCalledWith([
    tieId('sco.tennents', 't1'), tieId('sco.tennents', 't2'),
  ]);
});
