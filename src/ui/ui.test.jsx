import { render, screen, within } from '@testing-library/react';
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

import FixtureRow, { timelinePoints, meetingBalance } from './FixtureRow.jsx';
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
  const { container } = render(
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

  // tap again closes it — content stays mounted (clipped to height 0 by
  // Collapse) rather than unmounting, so the close glide has real content
  // to shut around instead of an already-empty box (fix round 1, HIGH).
  await user.click(screen.getByRole('button', { expanded: true }));
  expect(screen.getByRole('link', { name: 'Full detail →' })).toBeInTheDocument();
  expect(container.querySelector('.collapse-glide').style.height).toBe('0px');
});

test('FixtureRow: an own goal stays under its event teamId — ESPN already credits the benefiting side', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { events: [
      // Live-feed convention (verified against 8 real own goals at the
      // v1.1 final review): an own-goal event's teamId is the side the
      // goal counts FOR. teamId '256' is Celtic (home) — a St Johnstone
      // defender put it through his own net, the feed stamps Celtic's id,
      // and the drawer must NOT flip it back.
      { minute: "30'", type: 'Own Goal', player: 'Unlucky Defender', teamId: '256', scoringPlay: true },
    ] } },
  });
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));

  // The own goal's dot sits on the HOME side of the match line...
  const dot = container.querySelector('[data-testid="goal-dot"]');
  expect(dot).toHaveAttribute('data-side', 'home');
  // ...and its scorer line lives in the home column, not away's.
  const homeCol = container.querySelector('[data-testid="scorer-col-home"]');
  const awayCol = container.querySelector('[data-testid="scorer-col-away"]');
  expect(homeCol.textContent).toContain('Defender');
  expect(homeCol.textContent).toContain('(og)');
  expect(awayCol.textContent).not.toContain('Defender');
});

// --- the match line (spec §13.22, task 1) ---

test('FixtureRow: the result drawer\'s match line plots a goal dot per side in its club colour, muted when a club carries none', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { events: [
      { minute: "16'", type: 'Goal', player: 'Lawrence Shankland', teamId: '256', scoringPlay: true },
      { minute: "54'", type: 'Goal', player: 'Billy Mckay', teamId: '267', scoringPlay: true },
    ] } },
  });
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft', {
        home: side({ teamId: '256', name: 'Heart of Midlothian', colour: '009921' }),
        away: side({ teamId: '267', name: 'Inverness CT', colour: null }),
      })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  const dots = container.querySelectorAll('[data-testid="goal-dot"]');
  expect(dots).toHaveLength(2);
  const homeDot = [...dots].find(d => d.dataset.side === 'home');
  const awayDot = [...dots].find(d => d.dataset.side === 'away');
  expect(homeDot.style.background).toBe('rgb(0, 153, 33)'); // #009921
  expect(homeDot).not.toHaveClass('bg-muted');
  expect(awayDot.style.background).toBe('');
  expect(awayDot).toHaveClass('bg-muted');
});

test('FixtureRow: a 0-0 result still renders the match line axis with no dots — nothing to list is honest', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({ isLoading: false, isError: false, data: { detail: { events: [] } } });
  const { container } = render(
    <MemoryRouter><FixtureRow fixture={fixture('ft')} followedIds={new Set()} /></MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(container.querySelector('[data-testid="match-axis"]')).toBeInTheDocument();
  expect(container.querySelectorAll('[data-testid="goal-dot"]')).toHaveLength(0);
  // both scorer columns still render, just with nothing listed under them
  expect(container.querySelector('[data-testid="scorer-col-home"]')).toBeInTheDocument();
  expect(container.querySelector('[data-testid="scorer-col-away"]')).toBeInTheDocument();
});

test('FixtureRow: the result drawer lists scorers in two columns under each club\'s sub-label, surname + minutes fragment, one line per scorer', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { events: [
      { minute: "16'", type: 'Goal', player: 'Lawrence Shankland', teamId: '256', scoringPlay: true },
      { minute: "82'", type: 'Penalty', player: 'David Miller', teamId: '256', scoringPlay: true },
      { minute: "90+4'", type: 'Penalty', player: 'David Miller', teamId: '256', scoringPlay: true },
      { minute: "54'", type: 'Goal', player: 'Aaron Doran', teamId: '267', scoringPlay: true },
    ] } },
  });
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft', {
        home: side({ teamId: '256', name: 'Heart of Midlothian', shortName: 'Hearts' }),
        away: side({ teamId: '267', name: 'Inverness CT', shortName: 'Inverness CT' }),
      })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  const homeCol = container.querySelector('[data-testid="scorer-col-home"]');
  const awayCol = container.querySelector('[data-testid="scorer-col-away"]');
  expect(homeCol.textContent).toContain('Hearts'); // club shortName sub-label
  // one line per scorer — Miller's two goals join onto ONE line, comma-joined
  expect(homeCol.querySelectorAll('p')).toHaveLength(3); // sub-label + Shankland + Miller
  expect(homeCol.textContent).toContain('Shankland');
  expect(homeCol.textContent).toContain('16');
  expect(homeCol.textContent).toContain('Miller');
  expect(homeCol.textContent).toContain('82');
  expect(homeCol.textContent).toContain('90+4');
  expect(homeCol.textContent).toContain('(pen)');
  expect(awayCol.textContent).toContain('Doran');
  expect(awayCol.textContent).not.toContain('Shankland');
});

test('FixtureRow: the result drawer\'s scorer sub-labels reuse the exact FieldBoard muted sub-label recipe — typography-consistency constraint, executable', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({ isLoading: false, isError: false, data: { detail: { events: [] } } });
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft', {
        home: side({ teamId: '256', name: 'Celtic', shortName: 'Celtic' }),
      })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  const label = container.querySelector('[data-testid="scorer-col-home"] p');
  expect(label.textContent).toBe('Celtic');
  expect(label.className).toBe('font-sans text-[9px] uppercase tracking-[.14em] text-muted mb-3');
});

test('FixtureRow: the result drawer\'s meta line joins venue and attendance, dropping whichever is absent', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { events: [], gameInfo: { venue: 'Tynecastle Park', attendance: 15327 } } },
  });
  render(<MemoryRouter><FixtureRow fixture={fixture('ft')} followedIds={new Set()} /></MemoryRouter>);
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(screen.getByText('Tynecastle Park · Attendance 15,327')).toBeInTheDocument();
});

test('FixtureRow: the result drawer\'s meta line renders venue alone when attendance is unpublished', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { events: [], gameInfo: { venue: 'Tynecastle Park', attendance: null } } },
  });
  render(<MemoryRouter><FixtureRow fixture={fixture('ft')} followedIds={new Set()} /></MemoryRouter>);
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(screen.getByText('Tynecastle Park')).toBeInTheDocument();
  expect(screen.queryByText(/Attendance/)).not.toBeInTheDocument();
});

test('FixtureRow: the result drawer renders no meta line when neither venue nor attendance exist', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({ isLoading: false, isError: false, data: { detail: { events: [] } } });
  const { container } = render(
    <MemoryRouter><FixtureRow fixture={fixture('ft')} followedIds={new Set()} /></MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  const metaLine = [...container.querySelectorAll('p')]
    .find(p => p.className === 'font-sans text-[10px] text-muted tabular-nums mt-2');
  expect(metaLine).toBeUndefined();
});

test('FixtureRow: a sched espn row\'s drawer shows the last 3 head-to-head meetings, most recent first, as aligned rows', async () => {
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
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));

  const rows = container.querySelectorAll('[data-testid="meeting-row"]');
  expect(rows).toHaveLength(3); // capped at 3, the oldest (2022) meeting dropped
  const rowText = [...rows].map(r => r.textContent);
  expect(rowText[0]).toContain('10 Aug 2025'); // most recent (2025) first
  expect(rowText[0]).toContain('1–2');
  expect(rowText[1]).toContain('10 Aug 2024');
  expect(rowText[1]).toContain('3–0');
  expect(rowText[2]).toContain('10 Aug 2023');
  expect(rowText[2]).toContain('2–2');
});

test('FixtureRow: each meeting row shows crests in that meeting\'s OWN home/away order, with tabular scores', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { headToHead: { meetings: [
      { date: '2026-03-04', homeName: 'Aberdeen', awayName: 'Celtic', homeScore: 1, awayScore: 2 },
      { date: '2025-12-21', homeName: 'Celtic', awayName: 'Aberdeen', homeScore: 3, awayScore: 1 },
    ] } } },
  });
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled', {
        home: side({ teamId: '256', name: 'Celtic', crestUrl: 'celtic.png' }),
        away: side({ teamId: '299', name: 'Aberdeen', crestUrl: 'aberdeen.png' }),
      })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));

  const rows = container.querySelectorAll('[data-testid="meeting-row"]');
  expect(rows).toHaveLength(2);
  const crests0 = rows[0].querySelectorAll('img');
  expect(crests0[0]).toHaveAttribute('src', 'aberdeen.png'); // that meeting's own home first
  expect(crests0[1]).toHaveAttribute('src', 'celtic.png');
  expect(rows[0].querySelector('.tabular-nums')).toBeInTheDocument();

  const crests1 = rows[1].querySelectorAll('img');
  expect(crests1[0]).toHaveAttribute('src', 'celtic.png');
  expect(crests1[1]).toHaveAttribute('src', 'aberdeen.png');
});

// --- the balance bar (spec §13.22, task 1) ---

test('FixtureRow: the fixture drawer\'s balance bar segments are proportional and club-coloured, with a captioned tally beneath', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { headToHead: { meetings: [
      { date: '2026-03-04', homeName: 'Aberdeen', awayName: 'Celtic', homeScore: 1, awayScore: 2 }, // Celtic win
      { date: '2025-12-21', homeName: 'Celtic', awayName: 'Aberdeen', homeScore: 1, awayScore: 1 }, // draw
      { date: '2025-08-10', homeName: 'Aberdeen', awayName: 'Celtic', homeScore: 0, awayScore: 2 }, // Celtic win
    ] } } },
  });
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled', {
        home: side({ teamId: '256', name: 'Celtic', shortName: 'Celtic', colour: '009921' }),
        away: side({ teamId: '299', name: 'Aberdeen', shortName: 'Aberdeen', colour: null }),
      })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));

  const homeSeg = container.querySelector('[data-testid="balance-seg-home"]');
  const drawSeg = container.querySelector('[data-testid="balance-seg-draws"]');
  const awaySeg = container.querySelector('[data-testid="balance-seg-away"]');
  expect(homeSeg.style.width).toBe('66.66666666666666%');
  expect(drawSeg.style.width).toBe('33.33333333333333%');
  // Zero-count segments don't render at all (v1.4 final-review fix: the
  // bar carries ink dividers, and a divider against an empty segment
  // would paint a stray line). The caption still tallies the zero.
  expect(awaySeg).toBeNull();
  expect(homeSeg.style.background).toBe('rgb(0, 153, 33)'); // #009921
  expect(drawSeg).toHaveClass('bg-rule');
  expect(homeSeg.parentElement).toHaveClass('border-ink'); // Shirt's outline idiom — pale kits stay visible
  expect(screen.getByText('Celtic 2')).toBeInTheDocument();
  expect(screen.getByText('drawn 1')).toBeInTheDocument();
  expect(screen.getByText('Aberdeen 0')).toBeInTheDocument();
});

test('FixtureRow: the fixture drawer\'s "Recent meetings" sub-label and balance caption reuse existing muted-sans recipes exactly — typography-consistency constraint, executable', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { headToHead: { meetings: [
      { date: '2026-03-04', homeName: 'Aberdeen', awayName: 'Celtic', homeScore: 1, awayScore: 2 },
    ] } } },
  });
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled', {
        home: side({ teamId: '256', name: 'Celtic', shortName: 'Celtic' }),
        away: side({ teamId: '299', name: 'Aberdeen', shortName: 'Aberdeen' }),
      })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(screen.getByText('Recent meetings').className)
    .toBe('font-sans text-[9px] uppercase tracking-[.14em] text-muted mb-3');
  expect(screen.getByText('Celtic 1').closest('div'))
    .toHaveClass('font-sans', 'text-[10px]', 'text-muted', 'tabular-nums');
});

test('FixtureRow: the fixture drawer\'s meta line joins venue, weekday date and kickoff time', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { headToHead: { meetings: [] } } },
  });
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled', {
        venue: 'Celtic Park', kickoff: '2026-09-02T18:45:00Z',
      })} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(screen.getByText(/Celtic Park · Wed 2 Sept · \d{2}:\d{2}/)).toBeInTheDocument();
});

test('FixtureRow: a sched espn row with no head-to-head history says so, still links through, and shows no balance bar', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { headToHead: { meetings: [] } } },
  });
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(screen.getByText('No recent meetings.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Full detail →' })).toBeInTheDocument();
  expect(container.querySelector('[data-testid="balance-seg-home"]')).not.toBeInTheDocument();
});

test('FixtureRow: the drawer shows skeleton lines (aria-hidden) while useMatchDetail is pending, not the old fetching text, with no link yet', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({ isLoading: true, isError: false, data: undefined });
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  expect(screen.queryByText('Fetching the detail…')).not.toBeInTheDocument();
  const skeleton = container.querySelectorAll('.skeleton-pulse');
  expect(skeleton).toHaveLength(3);
  skeleton.forEach(bar => expect(bar.closest('[aria-hidden="true"]')).toBeTruthy());
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

// --- the Collapse wrapper (spec §13.21): the drawer's open/close is now
// driven by Collapse's measured-height glide, not a plain mount/unmount —
// this is the reported defect's fix ("content loading and then jutting
// into place"). Collapse's own open/close/lazy-mount contract is tested
// directly in Collapse.test.jsx; these only check FixtureRow wires it in
// (the drawer content lives inside the collapse-glide element) and that
// content landing crossfades in rather than hard-cutting. ---

test('FixtureRow: the open drawer sits inside a Collapse (collapse-glide), and landed content crossfades in (.xfade-in)', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { headToHead: { meetings: [] } } },
  });
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('scheduled')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  const collapse = container.querySelector('.collapse-glide');
  expect(collapse).toBeInTheDocument();
  expect(within(collapse).getByText('No recent meetings.')).toBeInTheDocument();
  expect(collapse.querySelector('.xfade-in')).toBeInTheDocument();
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

// --- v1.3.1 hotfix (user report): Collapse's overflow-hidden clipped the
// drawer's own -mx-5 full-bleed, insetting the box off the screen edges.
// The bleed lives on the Collapse wrapper now; the drawer keeps only its
// horizontal padding. ---

test('FixtureRow: the drawer bleeds edge-to-edge via the Collapse wrapper, not a clipped negative margin', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({ isLoading: true, isError: false, data: undefined });
  const { container } = render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));
  const collapse = container.querySelector('.collapse-glide');
  expect(collapse).toHaveClass('-mx-5');
  const drawer = collapse.querySelector('.bg-drawer');
  expect(drawer.className).not.toMatch(/-mx-5/);
});

// --- timelinePoints (spec §13.22, task 1: the match line) — pure, no
// rendering. scale/clamp/skip logic tested directly per the brief. ---

test('timelinePoints: places goals proportionally on the 90-scale by minute, HOME above / AWAY below via creditedSide', () => {
  const points = timelinePoints([
    { minute: "9'", type: 'Goal', teamId: '256', scoringPlay: true },
    { minute: "81'", type: 'Goal', teamId: '267', scoringPlay: true },
  ], fixture('ft'));
  expect(points).toEqual([
    { pct: 10, side: 'home', minute: 9, labelled: true },
    { pct: 90, side: 'away', minute: 81, labelled: true },
  ]);
});

test("timelinePoints: a 90'+4' stoppage-time goal parses its leading minute integer and clamps to the scale's edge", () => {
  const points = timelinePoints([
    { minute: "90'+4'", type: 'Goal', teamId: '256', scoringPlay: true },
  ], fixture('ft'));
  expect(points).toEqual([{ pct: 100, side: 'home', minute: 90, labelled: true }]);
});

test('timelinePoints: a minute past 120 still clamps to the right edge rather than overflowing 100%', () => {
  const points = timelinePoints([
    { minute: "105'", type: 'Goal', teamId: '256', scoringPlay: true },
    { minute: "130'", type: 'Goal', teamId: '267', scoringPlay: true },
  ], fixture('ft'));
  expect(points[1]).toEqual({ pct: 100, side: 'away', minute: 130, labelled: true });
});

test("timelinePoints: a 105' goal flips the scale from 90 to 120, repositioning every goal on the shared axis", () => {
  const scale90 = timelinePoints([{ minute: "60'", teamId: '256', scoringPlay: true }], fixture('ft'));
  expect(scale90[0].pct).toBeCloseTo(66.667, 2); // 60/90

  const scale120 = timelinePoints([
    { minute: "60'", teamId: '256', scoringPlay: true },
    { minute: "105'", teamId: '267', scoringPlay: true },
  ], fixture('ft'));
  expect(scale120[0].pct).toBe(50); // 60/120, same raw minute now reads differently
  expect(scale120[1].pct).toBe(87.5); // 105/120
});

test('timelinePoints: skips a label within 7% of the last LABELLED dot on the same side; the other side tracks independently', () => {
  // Points are chronological (sorted by minute), so the away dot at 41'
  // lands between the two home dots: 40, 41(away), 44, 70.
  const points = timelinePoints([
    { minute: "40'", teamId: '256', scoringPlay: true }, // home, pct 44.44 — first home dot: labelled
    { minute: "44'", teamId: '256', scoringPlay: true }, // home, pct 48.89 — 4.44% from last labelled home: skip
    { minute: "70'", teamId: '256', scoringPlay: true }, // home, pct 77.78 — far from 44.44: labelled
    { minute: "41'", teamId: '267', scoringPlay: true }, // away, pct 45.56 — first away dot: always labelled
  ], fixture('ft'));
  expect(points.map(p => `${p.minute}:${p.side}`)).toEqual(['40:home', '41:away', '44:home', '70:home']);
  expect(points.map(p => p.labelled)).toEqual([true, true, false, true]);
});

test('timelinePoints: an own-goal event stays under its own teamId credit, same as the scorer prose (v1.1 lesson)', () => {
  const points = timelinePoints([
    { minute: "27'", type: 'Own Goal', teamId: '256', scoringPlay: true },
  ], fixture('ft'));
  expect(points).toEqual([{ pct: 30, side: 'home', minute: 27, labelled: true }]);
});

test('timelinePoints: non-scoring events, unparseable minutes and events crediting neither side are skipped, not crashed', () => {
  const points = timelinePoints([
    { minute: "10'", teamId: '256', scoringPlay: false }, // not a goal
    { minute: null, teamId: '256', scoringPlay: true }, // no minute
    { minute: "20'", teamId: 'nobody', scoringPlay: true }, // credits neither side
  ], fixture('ft'));
  expect(points).toEqual([]);
});

test('timelinePoints: no events yields an empty array (0-0 renders the bare axis)', () => {
  expect(timelinePoints([], fixture('ft'))).toEqual([]);
  expect(timelinePoints(undefined, fixture('ft'))).toEqual([]);
});

// --- meetingBalance (spec §13.22, task 1: the balance bar) — pure. ---

test('meetingBalance: attributes a win to this fixture\'s home club whichever side it played, both orientations', () => {
  const fx = fixture('scheduled', {
    home: side({ teamId: '256', name: 'Celtic' }),
    away: side({ teamId: '299', name: 'Aberdeen' }),
  });
  const result = meetingBalance([
    // this fixture's home club (Celtic) played AWAY here and won
    { homeName: 'Aberdeen', awayName: 'Celtic', homeScore: 1, awayScore: 2 },
    // this fixture's home club (Celtic) played HOME here and won
    { homeName: 'Celtic', awayName: 'Aberdeen', homeScore: 3, awayScore: 1 },
  ], fx);
  expect(result).toEqual({ homeWins: 2, draws: 0, awayWins: 0 });
});

test('meetingBalance: all meetings won by this fixture\'s away club count as awayWins regardless of orientation', () => {
  const fx = fixture('scheduled', {
    home: side({ teamId: '256', name: 'Celtic' }),
    away: side({ teamId: '299', name: 'Aberdeen' }),
  });
  const result = meetingBalance([
    { homeName: 'Aberdeen', awayName: 'Celtic', homeScore: 2, awayScore: 0 },
    { homeName: 'Celtic', awayName: 'Aberdeen', homeScore: 0, awayScore: 1 },
    { homeName: 'Aberdeen', awayName: 'Celtic', homeScore: 3, awayScore: 1 },
  ], fx);
  expect(result).toEqual({ homeWins: 0, draws: 0, awayWins: 3 });
});

test('meetingBalance: equal scores count as a draw regardless of orientation', () => {
  const fx = fixture('scheduled', {
    home: side({ teamId: '256', name: 'Celtic' }),
    away: side({ teamId: '299', name: 'Aberdeen' }),
  });
  const result = meetingBalance([
    { homeName: 'Celtic', awayName: 'Aberdeen', homeScore: 1, awayScore: 1 },
    { homeName: 'Aberdeen', awayName: 'Celtic', homeScore: 2, awayScore: 2 },
  ], fx);
  expect(result).toEqual({ homeWins: 0, draws: 2, awayWins: 0 });
});

test('meetingBalance: no meetings yields all-zero counts', () => {
  expect(meetingBalance([], fixture('scheduled'))).toEqual({ homeWins: 0, draws: 0, awayWins: 0 });
});

// --- v1.4 final review, L4: the 120′ scale had unit coverage in
// timelinePoints but no RENDER assertion for MatchLine's extra-time
// tick set. ---

test('FixtureRow: an extra-time result renders the 120′ tick set — 0′, HT, 90′ and 120′', async () => {
  const user = userEvent.setup();
  useMatchDetail.mockReturnValue({
    isLoading: false, isError: false,
    data: { detail: { events: [
      { minute: "12'", type: 'Goal', player: 'Early Opener', teamId: '256', scoringPlay: true },
      { minute: "105'", type: 'Goal', player: 'Extra Time Hero', teamId: '256', scoringPlay: true },
    ] } },
  });
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft')} followedIds={new Set()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { expanded: false }));

  expect(screen.getByText('0′')).toBeInTheDocument();
  expect(screen.getByText('HT')).toBeInTheDocument();
  expect(screen.getByText('90′')).toBeInTheDocument();
  expect(screen.getByText('120′')).toBeInTheDocument();
});
