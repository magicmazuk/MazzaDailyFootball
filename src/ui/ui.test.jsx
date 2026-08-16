import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { byId } from '../domain/competitions.js';
import Crest from './Crest.jsx';
import StatusWord from './StatusWord.jsx';

// FixtureRow's drawer (spec §13.19.1) calls useMatchDetail directly —
// mocked here so drawer tests can control its loading/error/data shape
// without a QueryClientProvider, and so the "not called before first tap"
// assertion has a call count to inspect.
vi.mock('../data/queries.js', () => ({
  useMatchDetail: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
}));

import FixtureRow from './FixtureRow.jsx';
import { useMatchDetail } from '../data/queries.js';

beforeEach(() => {
  useMatchDetail.mockReset();
  useMatchDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false });
});

const side = (over = {}) => ({
  teamId: '10603', name: 'Auchinleck Talbot', shortName: 'Talbot',
  crestUrl: null, monogram: 'AT', colour: null, score: null, ...over,
});

test('Crest renders an img when a crest exists', () => {
  render(<Crest side={side({ crestUrl: 'x.png', name: 'Celtic' })} />);
  expect(screen.getByRole('img', { name: 'Celtic' })).toHaveAttribute('src', 'x.png');
});

test('Crest falls back to the monogram disc when crestUrl is null', () => {
  render(<Crest side={side()} />);
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('AT')).toBeInTheDocument();
});

const fixture = (status, over = {}) => ({
  id: 'e1', compId: 'sco.1', kickoff: '2026-08-22T14:00:00Z', status,
  minute: null, round: null, venue: null,
  home: side({ teamId: '256', name: 'Celtic', crestUrl: 'c.png' }),
  away: side({ teamId: '267', name: 'St Johnstone' }),
  ...over,
});

test('StatusWord: scheduled shows kickoff, live shows the minute, postponed shows P–P', () => {
  const { rerender } = render(<StatusWord fixture={fixture('scheduled')} />);
  expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  rerender(<StatusWord fixture={fixture('live', { minute: "63'" })} />);
  // tabular-nums (backlog, spec §13.18.4) — fixed-width digits so the
  // minute doesn't jitter as it ticks.
  expect(screen.getByText("63'")).toHaveClass('tabular-nums');
  rerender(<StatusWord fixture={fixture('postponed')} />);
  expect(screen.getByText('P–P')).toBeInTheDocument();
  rerender(<StatusWord fixture={fixture('ft')} />);
  expect(screen.getByText('FT')).toBeInTheDocument();
});

test('FixtureRow stars a followed side; a ft espn row\'s match link now lives in its drawer (spec §13.19.1)', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft', {
        home: side({ teamId: '256', name: 'Celtic', crestUrl: 'c.png', score: 2 }),
        away: side({ teamId: '267', name: 'St Johnstone', score: 0 }),
      })} followedIds={new Set(['256'])} />
    </MemoryRouter>,
  );
  expect(screen.getByText('★')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  // ft on an espn hasMatchDetail comp: no direct Link — tap the row to
  // reach the drawer's own Full detail → link instead.
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(screen.getByRole('link')).toHaveAttribute('href', '/match/sco.1/e1');
});

test('FixtureRow: crest click navigates to the team page, not the match', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  const { default: FixtureRowV2 } = await import('./FixtureRow.jsx');
  const routes = (await import('react-router-dom'));
  let where = null;
  function Probe() { where = routes.useLocation().pathname; return null; }
  render(
    <MemoryRouter initialEntries={['/']}>
      <FixtureRowV2 fixture={fixture('scheduled')} followedIds={new Set()} />
      <routes.Routes>
        <routes.Route path="*" element={<Probe />} />
      </routes.Routes>
    </MemoryRouter>,
  );
  await user.click(screen.getByLabelText('Celtic team page'));
  expect(where).toBe('/team/sco.1/256');
});

test('FixtureRow: tv badges render under the kickoff', () => {
  render(<MemoryRouter>
    <FixtureRow fixture={{ ...fixture('scheduled'), tv: ['Sky Sports'] }} followedIds={new Set()} />
  </MemoryRouter>);
  expect(screen.getByText('Sky')).toBeInTheDocument();
});

test('FixtureRow: a scheduled fixture with ESPN\'s phantom score:"0" renders no score digits', () => {
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled', {
        home: side({ teamId: '256', name: 'Celtic', crestUrl: 'c.png', score: 0 }),
        away: side({ teamId: '267', name: 'St Johnstone', score: 0 }),
      })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  expect(screen.queryByText('0')).not.toBeInTheDocument();
});

test('FixtureRow: an ft fixture still shows its scores', () => {
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft', {
        home: side({ teamId: '256', name: 'Celtic', crestUrl: 'c.png', score: 3 }),
        away: side({ teamId: '267', name: 'St Johnstone', score: 0 }),
      })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('0')).toBeInTheDocument();
});

// --- context line (spec §13.12) ---

test('FixtureRow: the context line shows comp shortName + round, and tapping it navigates to the competition page', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  const routes = (await import('react-router-dom'));
  let where = null;
  function Probe() { where = routes.useLocation().pathname; return null; }
  render(
    <MemoryRouter initialEntries={['/']}>
      <FixtureRow fixture={fixture('scheduled', { compId: 'sco.cis', round: 'fourth-round' })}
        followedIds={new Set()} />
      <routes.Routes>
        <routes.Route path="*" element={<Probe />} />
      </routes.Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText('League Cup · Fourth round')).toBeInTheDocument();
  await user.click(screen.getByLabelText('League Cup page'));
  expect(where).toBe('/competition/sco.cis');
});

test('FixtureRow: showContext={false} renders no context line', () => {
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled', { compId: 'sco.cis', round: 'fourth-round' })}
        followedIds={new Set()} showContext={false} />
    </MemoryRouter>,
  );
  expect(screen.queryByText(/League Cup/)).not.toBeInTheDocument();
  // sco.cis is an espn hasMatchDetail comp, so a scheduled row is itself a
  // toggle button now (spec §13.19.1) — the two crest buttons plus the row.
  expect(screen.getAllByRole('button')).toHaveLength(3);
});

test('FixtureRow: an unknown compId renders no context line, and no crash', () => {
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled', { compId: 'not-a-real-comp' })}
        followedIds={new Set()} />
    </MemoryRouter>,
  );
  expect(screen.getAllByRole('button')).toHaveLength(2); // just the two crest buttons
});

// --- the fixture drawer (spec §13.19.1) ---

test('FixtureRow: a ft espn row toggles a drawer with scorers and attendance, and useMatchDetail is not called before the first tap', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: {
      events: [
        { minute: "12'", type: 'Goal', player: 'Daizen Maeda', teamId: '256', scoringPlay: true },
        { minute: "61'", type: 'Goal', player: 'Daizen Maeda', teamId: '256', scoringPlay: true },
        { minute: "45+2'", type: 'Penalty', player: 'Reo Hatate', teamId: '256', scoringPlay: true },
      ],
      gameInfo: { attendance: 58876 },
    } },
  });
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  expect(useMatchDetail).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { expanded: false }));

  expect(useMatchDetail).toHaveBeenCalledWith(byId('sco.1'), 'e1', false);
  const link = screen.getByRole('link', { name: 'Full detail →' });
  expect(link).toHaveAttribute('href', '/match/sco.1/e1');
  const drawer = link.parentElement;
  expect(drawer.textContent).toContain('Maeda 12');
  expect(drawer.textContent).toContain('61');
  expect(drawer.textContent).toContain('Hatate 45+2');
  expect(drawer.textContent).toContain('(pen)');
  expect(drawer.textContent).toContain('Attendance 58,876');

  // tap again closes it
  await user.click(screen.getByRole('button', { expanded: true }));
  expect(screen.queryByRole('link', { name: 'Full detail →' })).not.toBeInTheDocument();
});

test('FixtureRow: an own goal credits the side that benefited, not the committing team (review fix)', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { events: [
      // teamId '267' is St Johnstone (away) — this codebase's own-goal
      // convention (MatchRoom.test.jsx's Goldson/Rangers fixture) is that
      // teamId names the COMMITTING side, so Celtic (home) gets the credit.
      { minute: "30'", type: 'Own Goal', player: 'Committing Player', teamId: '267', scoringPlay: true },
    ] } },
  });
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));

  const link = screen.getByRole('link', { name: 'Full detail →' });
  const drawer = link.parentElement;
  expect(drawer.textContent).toContain('Celtic: Committing Player 30');
  expect(drawer.textContent).toContain('(og)');
  expect(drawer.textContent).not.toContain('St Johnstone: Committing Player');
});

test('FixtureRow: a sched espn row\'s drawer shows the last 3 head-to-head meetings, most recent first', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { headToHead: { meetings: [
      { date: '2024-08-10', homeName: 'Celtic', awayName: 'St Johnstone', homeScore: 3, awayScore: 0 },
      { date: '2025-08-10', homeName: 'St Johnstone', awayName: 'Celtic', homeScore: 1, awayScore: 2 },
      { date: '2023-08-10', homeName: 'Celtic', awayName: 'St Johnstone', homeScore: 2, awayScore: 2 },
      { date: '2022-08-10', homeName: 'Celtic', awayName: 'St Johnstone', homeScore: 4, awayScore: 1 },
    ] } } },
  });
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));

  const link = screen.getByRole('link', { name: 'Full detail →' });
  const drawer = link.parentElement;
  const lines = [...drawer.querySelectorAll('p')].map(p => p.textContent);
  expect(lines).toHaveLength(3); // capped at 3, the oldest (2022) meeting dropped
  expect(lines[0]).toContain('St Johnstone 1–2 Celtic'); // most recent (2025) first
  expect(lines[1]).toContain('Celtic 3–0 St Johnstone'); // 2024
  expect(lines[2]).toContain('Celtic 2–2 St Johnstone'); // 2023
});

test('FixtureRow: a sched espn row with no head-to-head history says so, and still links through', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { headToHead: { meetings: [] } } },
  });
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(screen.getByText('No recent meetings.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Full detail →' })).toBeInTheDocument();
});

test('FixtureRow: the drawer shows a muted loading line while useMatchDetail is pending, with no link yet', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({ isLoading: true, isError: false, data: undefined });
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(screen.getByText('Fetching the detail…')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('FixtureRow: the drawer shows a muted "unavailable" line on a failed fetch, with no link', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({ isLoading: false, isError: true, data: undefined });
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(screen.getByText('Match detail unavailable.')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('FixtureRow: a live row stays a plain Link (no aria-expanded) — the room is what you want mid-match', () => {
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('live', { minute: "63'" })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link')).toHaveAttribute('href', '/match/sco.1/e1');
  expect(screen.queryByRole('button', { expanded: false })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { expanded: true })).not.toBeInTheDocument();
});

test('FixtureRow: a BBC-competition row (no match detail) stays a plain Link', () => {
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft', {
        compId: 'scottish-league-one',
        home: side({ teamId: '10603', name: 'Auchinleck Talbot' }),
        away: side({ teamId: '267', name: 'St Johnstone' }),
      })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link')).toHaveAttribute('href', '/match/scottish-league-one/e1');
  expect(screen.queryByRole('button', { expanded: false })).not.toBeInTheDocument();
});

test('FixtureRow: the crest button still navigates to the team page from an expandable row, without toggling the drawer', async () => {
  const user = userEvent.setup();
  const routes = await import('react-router-dom');
  let where = null;
  function Probe() { where = routes.useLocation().pathname; return null; }
  render(
    <MemoryRouter initialEntries={['/']}>
      <FixtureRow fixture={fixture('ft', {
        home: side({ teamId: '256', name: 'Celtic', crestUrl: 'c.png' }),
      })} followedIds={new Set()} />
      <routes.Routes>
        <routes.Route path="*" element={<Probe />} />
      </routes.Routes>
    </MemoryRouter>,
  );
  await user.click(screen.getByLabelText('Celtic team page'));
  expect(where).toBe('/team/sco.1/256');
  // the row itself must not have toggled open as a side effect
  expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
});
