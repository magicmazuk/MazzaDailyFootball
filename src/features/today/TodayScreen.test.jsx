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
  // TodayView renders Papers (The papers, spec §13.19.2), which calls this
  // directly — stubbed so these TodayScreen wiring tests don't need real
  // news data of their own.
  useNews: vi.fn(() => ({ isLoading: false, data: { items: [] } })),
  // ...and the highlights reel (spec §13.36), which fetches for itself the
  // same way — an empty reel renders nothing.
  useHighlights: vi.fn(() => []),
}));

import TodayScreen from './TodayScreen.jsx';
import { useTodayWindows, useAllSeasonFixtures, useTable } from '../../data/queries.js';

const loadingResults = comps => comps.map(() =>
  ({ isLoading: true, isSuccess: false, isError: false, data: undefined }));

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({
    followed: {}, hiddenComps: COMPETITIONS.map(c => c.id),
    seenTies: {}, seenSeeded: false, seededComps: {},
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
// Per-competition seeding (fix, replacing an earlier global-latch design
// that had two live defects — see store/prefs.js's doc comment and the
// dedicated regression tests below).

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
  // sco.tennents already has an established baseline (seeded earlier) and
  // these two ties are absent from seenTies — a genuinely new, unrevealed
  // draw, not first-run noise.
  usePrefs.setState({ followed: {}, seenTies: {}, seededComps: { 'sco.tennents': true } });
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
    followed: {}, seededComps: { 'sco.tennents': true },
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

// --- club-centric phase-draw invitations (spec §13.15) ---

const phaseDrawFixtures = [
  { id: 'p1', compId: 'sco.tennents', kickoff: '2026-08-20T15:00:00Z', status: 'scheduled',
    round: 'league-phase', minute: null,
    home: { teamId: '256', name: 'Celtic', crestUrl: null, monogram: 'CE' },
    away: { teamId: 'o1', name: 'Opponent One', crestUrl: null, monogram: 'O1' } },
  { id: 'p2', compId: 'sco.tennents', kickoff: '2026-08-20T17:00:00Z', status: 'scheduled',
    round: 'league-phase', minute: null,
    home: { teamId: 'o2', name: 'Opponent Two', crestUrl: null, monogram: 'O2' },
    away: { teamId: '256', name: 'Celtic', crestUrl: null, monogram: 'CE' } },
];

function stubSettledPhaseSeasons() {
  useAllSeasonFixtures.mockImplementation(comps => comps.map(c => ({
    isLoading: false, isSuccess: true, isError: false,
    data: { fixtures: c.id === 'sco.tennents' ? phaseDrawFixtures : [], asOf: null },
  })));
  useTodayWindows.mockImplementation(comps => comps.map(c => ({
    isLoading: false,
    data: { fixtures: c.id === 'sco.tennents' ? phaseDrawFixtures : [], asOf: null },
  })));
}

test('a followed club with unrevealed phase fixtures shows its invitation card and hides its fixtures from Today', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
  usePrefs.setState({
    followed: { 256: { id: '256', name: 'Celtic' } },
    seenTies: {}, seededComps: { 'sco.tennents': true },
  });
  onlyScoTennentsVisible();
  stubSettledPhaseSeasons();

  render(<MemoryRouter><TodayScreen /></MemoryRouter>);

  expect(screen.getByText("CELTIC'S DRAW IS IN")).toBeInTheDocument();
  expect(screen.queryByText('Opponent One')).not.toBeInTheDocument();
  expect(screen.queryByText('Opponent Two')).not.toBeInTheDocument();
  vi.useRealTimers();
});

test('an unfollowed club\'s phase fixtures show no invitation card and stay visible on Today', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
  usePrefs.setState({
    followed: {}, seenTies: {}, seededComps: { 'sco.tennents': true },
  });
  onlyScoTennentsVisible();
  stubSettledPhaseSeasons();

  render(<MemoryRouter><TodayScreen /></MemoryRouter>);

  expect(screen.queryByText(/DRAW IS IN/)).not.toBeInTheDocument();
  expect(screen.getByText('Opponent One')).toBeInTheDocument();
  expect(screen.getByText('Opponent Two')).toBeInTheDocument();
  vi.useRealTimers();
});

// --- per-competition seeding regression tests (fix per review) ---

test('a comp that resolves before a sibling cup query settles is seeded on its own — no false draw card while the sibling is still pending', () => {
  // Reproduces the first defect: under the old global-latch design, seeding
  // waited for EVERY cup query to settle, so sco.tennents' (pre-existing,
  // not genuinely new) round would misread as an "unrevealed draw" for as
  // long as eng.fa stayed pending — this asserts the fixed, settled state.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
  usePrefs.setState({
    followed: {}, seenTies: {}, seededComps: {}, seenSeeded: false,
    hiddenComps: COMPETITIONS.filter(c => !['sco.tennents', 'eng.fa'].includes(c.id)).map(c => c.id),
  });
  useAllSeasonFixtures.mockImplementation(comps => comps.map(c => (c.id === 'sco.tennents'
    ? { isLoading: false, isSuccess: true, isError: false, data: { fixtures: drawFixtures, asOf: null } }
    : { isLoading: true, isSuccess: false, isError: false, data: undefined })));
  useTodayWindows.mockImplementation(comps => comps.map(c => (c.id === 'sco.tennents'
    ? { isLoading: false, data: { fixtures: drawFixtures, asOf: null } }
    : { isLoading: true, data: undefined })));

  render(<MemoryRouter><TodayScreen /></MemoryRouter>);

  expect(screen.queryByText('THE DRAW IS IN')).not.toBeInTheDocument();
  expect(usePrefs.getState().seededComps['sco.tennents']).toBe(true);
  expect(usePrefs.getState().seenTies[tieId('sco.tennents', 't1')]).toBe(true);
  expect(usePrefs.getState().seededComps['eng.fa']).toBeUndefined();
  vi.useRealTimers();
});

test('a comp whose query fails is simply not seeded yet, and seeds correctly once it later recovers', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
  usePrefs.setState({
    followed: {}, seenTies: {}, seededComps: {}, seenSeeded: false,
    hiddenComps: COMPETITIONS.filter(c => c.id !== 'sco.tennents').map(c => c.id),
  });
  useAllSeasonFixtures.mockImplementation(comps => comps.map(() =>
    ({ isLoading: false, isSuccess: false, isError: true, data: undefined })));
  useTodayWindows.mockImplementation(loadingResults);

  const { rerender } = render(<MemoryRouter><TodayScreen /></MemoryRouter>);
  expect(usePrefs.getState().seededComps['sco.tennents']).toBeUndefined();
  expect(screen.queryByText('THE DRAW IS IN')).not.toBeInTheDocument();

  // Recovery: the same comp's query later succeeds.
  useAllSeasonFixtures.mockImplementation(comps => comps.map(() =>
    ({ isLoading: false, isSuccess: true, isError: false, data: { fixtures: drawFixtures, asOf: null } })));
  useTodayWindows.mockImplementation(comps => comps.map(() =>
    ({ isLoading: false, data: { fixtures: drawFixtures, asOf: null } })));
  rerender(<MemoryRouter><TodayScreen /></MemoryRouter>);

  expect(usePrefs.getState().seededComps['sco.tennents']).toBe(true);
  // Newly-established baseline — its pre-existing round is marked seen on
  // arrival, not announced as a false "new draw".
  expect(screen.queryByText('THE DRAW IS IN')).not.toBeInTheDocument();
  vi.useRealTimers();
});

test('a legacy install (old global seenSeeded latch) does not re-seed or flood false draw cards', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
  usePrefs.setState({
    followed: {}, seenSeeded: true, seededComps: {},
    // What the OLD global seed already wrote for this comp, pre-migration.
    seenTies: { [tieId('sco.tennents', 't1')]: true, [tieId('sco.tennents', 't2')]: true },
    hiddenComps: COMPETITIONS.filter(c => c.id !== 'sco.tennents').map(c => c.id),
  });
  stubSettledSeasons();

  render(<MemoryRouter><TodayScreen /></MemoryRouter>);

  // Latched via the legacy shortcut, seenTies left exactly as it was — no
  // re-seed, no duplicate/overwritten entries.
  expect(usePrefs.getState().seededComps['sco.tennents']).toBe(true);
  expect(usePrefs.getState().seenTies).toEqual({
    [tieId('sco.tennents', 't1')]: true, [tieId('sco.tennents', 't2')]: true,
  });
  expect(screen.queryByText('THE DRAW IS IN')).not.toBeInTheDocument();
  vi.useRealTimers();
});

test('a genuinely new round published after this comp was already seeded shows its invitation card', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
  usePrefs.setState({
    followed: {}, seenTies: {}, seededComps: {}, seenSeeded: false,
    hiddenComps: COMPETITIONS.filter(c => c.id !== 'sco.tennents').map(c => c.id),
  });
  const baselineFixtures = [
    { id: 'b1', compId: 'sco.tennents', kickoff: '2026-08-18T15:00:00Z', status: 'ft',
      round: 'third-round', minute: null,
      home: { teamId: 'x1', name: 'X One', crestUrl: null, monogram: 'X1' },
      away: { teamId: 'x2', name: 'X Two', crestUrl: null, monogram: 'X2' } },
  ];
  useAllSeasonFixtures.mockImplementation(comps => comps.map(() =>
    ({ isLoading: false, isSuccess: true, isError: false, data: { fixtures: baselineFixtures, asOf: null } })));
  useTodayWindows.mockImplementation(comps => comps.map(() =>
    ({ isLoading: false, data: { fixtures: baselineFixtures, asOf: null } })));

  const { rerender } = render(<MemoryRouter><TodayScreen /></MemoryRouter>);
  expect(usePrefs.getState().seededComps['sco.tennents']).toBe(true);
  expect(screen.queryByText('THE DRAW IS IN')).not.toBeInTheDocument();

  // Later refetch: a genuinely new fourth-round draw appears alongside the
  // already-seeded baseline.
  const withNewRound = [...baselineFixtures, ...drawFixtures];
  useAllSeasonFixtures.mockImplementation(comps => comps.map(() =>
    ({ isLoading: false, isSuccess: true, isError: false, data: { fixtures: withNewRound, asOf: null } })));
  useTodayWindows.mockImplementation(comps => comps.map(() =>
    ({ isLoading: false, data: { fixtures: withNewRound, asOf: null } })));
  rerender(<MemoryRouter><TodayScreen /></MemoryRouter>);

  expect(screen.getByText('THE DRAW IS IN')).toBeInTheDocument();
  vi.useRealTimers();
});
