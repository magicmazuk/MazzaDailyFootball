import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { byId } from '../../domain/competitions.js';

// Classified fetches only its airtime for itself (useUpcomingBroadcasts,
// the Papers self-containment precedent); fixtures and tables arrive as
// props from TodayScreen — stub the one hook so no QueryClientProvider is
// needed and the edition maths runs over pinned data alone.
vi.mock('../../data/queries.js', () => ({
  useUpcomingBroadcasts: vi.fn(() => []),
}));
import { useUpcomingBroadcasts } from '../../data/queries.js';
import Classified from './Classified.jsx';

beforeEach(() => {
  useUpcomingBroadcasts.mockImplementation(() => []);
});

// --- the Saturday card: 2026-08-29 is a real Saturday, BST, so 17:00
// London = 16:00Z. The movement season is edition.test.js's own proven
// synthetic (Aird holds top, Brora climbs two, Cults falls two, Elgin
// debuts) so the deltas asserted here are the domain suite's, verbatim. ---

const at = t => `2026-08-29T${t}:00+01:00`;
const T = {
  A: { teamId: '1', name: 'Aird' },
  B: { teamId: '2', name: 'Brora' },
  C: { teamId: '3', name: 'Cults' },
  D: { teamId: '4', name: 'Dyce' },
  E: { teamId: '5', name: 'Elgin' },
};
const result = (id, kickoff, home, hs, away, as) => ({
  id, kickoff, status: 'ft', minute: null,
  home: { ...home, score: hs }, away: { ...away, score: as },
});
const lastWeek = '2026-08-22T15:00:00+01:00';
const earlierRounds = [
  result('r1', lastWeek, T.A, 2, T.B, 0),
  result('r2', lastWeek, T.C, 1, T.D, 0),
  result('r3', lastWeek, T.A, 1, T.C, 0),
  result('r4', lastWeek, T.D, 0, T.B, 0),
];
const todaySco = [
  result('t1', at('15:00'), T.B, 3, T.C, 0),
  result('t2', at('15:00'), T.E, 1, T.D, 0),
];
const postponed = {
  id: 'pp1', kickoff: at('15:00'), status: 'postponed', minute: null,
  home: { teamId: '6', name: 'Forres', score: null },
  away: { teamId: '7', name: 'Golspie', score: null },
};
const engFt = result('e1', at('12:30'), { teamId: '360', name: 'Arsenal' }, 2,
  { teamId: '363', name: 'Chelsea' }, 1);
const engLive = {
  id: 'e2', kickoff: at('16:30'), status: 'live', minute: 35,
  home: { teamId: '357', name: 'Leeds', score: 0 },
  away: { teamId: '367', name: 'Spurs', score: 0 },
};
const engLive2 = {
  id: 'e3', kickoff: at('16:30'), status: 'live', minute: 35,
  home: { teamId: '349', name: 'Villa', score: 1 },
  away: { teamId: '371', name: 'Fulham', score: 1 },
};

const board = ({ live = [engLive] } = {}) => ([
  { comp: byId('sco.1'), fixtures: [...earlierRounds, ...todaySco, postponed] },
  { comp: byId('eng.1'), fixtures: [engFt, ...live] },
]);

// The official after-table for the synthetic season: A 6, B 4, E 3, C 3, D 1.
const trow = (position, teamId, name, points, played) =>
  ({ position, teamId, name, points, played });
const scoRows = [
  trow(1, '1', 'Aird', 6, 2),
  trow(2, '2', 'Brora', 4, 3),
  trow(3, '5', 'Elgin', 3, 1),
  trow(4, '3', 'Cults', 3, 3),
  trow(5, '4', 'Dyce', 1, 3),
];
const tables = { 'sco.1': scoRows, 'eng.1': null };

const FIVE_PAST_FIVE = new Date('2026-08-29T16:05:00Z'); // 17:05 London

const renderClassified = (props = {}) => render(
  <MemoryRouter>
    <Classified fixturesByComp={board()} tables={tables}
      followedIds={new Set(['2'])} now={FIVE_PAST_FIVE} {...props} />
  </MemoryRouter>,
);

// --- the settled law gates the whole block ---------------------------------

test('before 17:00 London the edition simply is not led — renders nothing', () => {
  const { container } = renderClassified({ now: new Date('2026-08-29T14:00:00Z') });
  expect(container.firstChild).toBeNull();
});

// --- masthead: kicker, heading, dateline -----------------------------------

test('kicker and heading carry the accent-caps and serif recipes', () => {
  renderClassified();
  const kicker = screen.getByText("The Five O'Clock Edition");
  expect(kicker).toHaveClass('font-sans', 'text-[10px]', 'uppercase', 'tracking-[.22em]', 'text-accent');
  const heading = screen.getByRole('heading', { name: 'The Classified' });
  expect(heading).toHaveClass('text-[21px]');
});

test('the dateline counts matches still in play while the card is unsettled', () => {
  renderClassified();
  expect(screen.getByText('Saturday 29 August · results so far — 1 in play')).toBeInTheDocument();
});

test('the dateline says full time across the card only when nothing is in play', () => {
  renderClassified({ fixturesByComp: board({ live: [] }) });
  expect(screen.getByText('Saturday 29 August · full time across the card')).toBeInTheDocument();
  expect(screen.queryByText(/in play/)).toBeNull();
});

// --- results: dense classified rows, per comp, links, no live leak ---------

test('results print per comp under the bordered label, each row a link to its match page', () => {
  renderClassified();
  const label = screen.getAllByText('Premiership')[0];
  expect(label).toHaveClass('font-sans', 'text-[9px]', 'tracking-[.18em]', 'uppercase',
    'text-muted', 'border-b', 'border-ink', 'pb-1');
  const hrefs = screen.getAllByRole('link').map(l => l.getAttribute('href'));
  expect(hrefs).toContain('/match/sco.1/t1');
  expect(hrefs).toContain('/match/sco.1/t2');
  expect(hrefs).toContain('/match/eng.1/e1');
  expect(hrefs).not.toContain('/match/eng.1/e2'); // live navigates nowhere from here
  expect(hrefs).not.toContain('/match/sco.1/pp1'); // postponed is print, not a door
  const t1 = screen.getAllByRole('link').find(l => l.getAttribute('href') === '/match/sco.1/t1');
  expect(within(t1).getByText('Brora')).toBeInTheDocument();
  expect(within(t1).getByText('3')).toHaveClass('tabular-nums');
  expect(within(t1).getByText('Cults')).toBeInTheDocument();
});

test('a live match never prints among the results — its names appear nowhere', () => {
  renderClassified();
  expect(screen.queryByText('Leeds')).toBeNull();
  expect(screen.queryByText('Spurs')).toBeNull();
});

test('a postponed fixture prints P–P, muted, and is not a link', () => {
  renderClassified();
  const mark = screen.getByText('P–P');
  expect(mark.closest('div')).toHaveClass('text-muted');
  expect(screen.getByText('Forres').closest('a')).toBeNull();
  expect(screen.getByText('Golspie')).toBeInTheDocument();
});

// --- stop-press ------------------------------------------------------------

test('one match in play prints the singular stop-press line, italic and muted', () => {
  renderClassified();
  const line = screen.getByText('One match in play — result in a later edition.');
  expect(line).toHaveClass('italic', 'text-muted');
});

test('two in play print the plural stop-press line and the dateline count agrees', () => {
  renderClassified({ fixturesByComp: board({ live: [engLive, engLive2] }) });
  expect(screen.getByText('2 in play — results in a later edition.')).toBeInTheDocument();
  expect(screen.getByText('Saturday 29 August · results so far — 2 in play')).toBeInTheDocument();
});

// --- the tables: movement marks over the official rows ---------------------

test('movement marks: a climb in ink, a fall muted, holds and debuts as rule-tone dashes', () => {
  renderClassified();
  expect(screen.getByText("as it stands · today's movement"))
    .toHaveClass('font-sans', 'text-[9px]', 'uppercase', 'tracking-[.18em]', 'text-muted');
  const up = screen.getByText('▲2'); // Brora, 4th → 2nd
  expect(up).toHaveClass('w-6', 'font-sans', 'text-[9px]', 'tabular-nums', 'text-ink');
  const down = screen.getByText('▼2'); // Cults, 2nd → 4th
  expect(down).toHaveClass('w-6', 'font-sans', 'text-[9px]', 'tabular-nums', 'text-muted');
  // Aird held top (delta 0) and Elgin debuted today (delta null) — both an
  // honest rule-tone dash, never a number.
  const dashes = screen.getAllByText('—');
  expect(dashes).toHaveLength(2);
  for (const d of dashes) expect(d).toHaveClass('w-6', 'font-sans', 'text-[9px]', 'tabular-nums', 'text-rule');
  // The followed club is starred in the accent 9px.
  expect(screen.getByText('★')).toHaveClass('text-accent', 'text-[9px]');
  // sco.1 renders label twice (results + table); eng.1 has no rows → once.
  expect(screen.getAllByText('Premiership')).toHaveLength(2);
  expect(screen.getAllByText('Premier League')).toHaveLength(1);
});

test('a followed club below 4th prints beneath the ellipsis, the MiniTable precedent', () => {
  renderClassified({ followedIds: new Set(['4']) }); // Dyce, 5th
  expect(screen.getByText('⋯')).toBeInTheDocument();
  const row = screen.getByText('★').closest('div');
  expect(within(row).getByText('Dyce')).toHaveClass('flex-1', 'min-w-0', 'truncate', 'text-[13px]');
  expect(within(row).getByText('5')).toHaveClass('w-4', 'font-sans', 'text-[10px]', 'text-muted', 'tabular-nums');
  expect(within(row).getByText('1')).toHaveClass('text-[13px]', 'tabular-nums');
});

// --- the stakes line -------------------------------------------------------

test('the stakes line prints the domain copy verbatim behind the accent rule', () => {
  renderClassified();
  const line = screen.getByText('Brora 2nd, 2 behind Aird.');
  expect(line).toHaveClass('text-[12.5px]', 'border-l-2', 'border-accent', 'pl-2.5');
});

test('no followed club in any table means no stakes line at all', () => {
  renderClassified({ followedIds: new Set(['999']) });
  expect(screen.queryByText(/behind|top by|level on points/)).toBeNull();
});

// --- the airtime foot ------------------------------------------------------

const bc = (show, start, channel) =>
  ({ comp: byId('sco.1'), show, pid: 'p0000001', title: show, start, end: null, channel });

test('the foot prints the first airing per show, earliest first — the repeat stays off', () => {
  useUpcomingBroadcasts.mockImplementation(() => [
    bc('Sportscene', '2026-08-29T18:15:00Z', 'BBC Scotland'), // 19:15 BST
    bc('Match of the Day', '2026-08-29T21:25:00Z', 'BBC One'), // 22:25 BST
    bc('Match of the Day', '2026-08-29T22:00:00Z', 'BBC One'), // 23:00 BST repeat
  ]);
  renderClassified();
  const foot = screen.getByText(
    'Tonight — Sportscene · 19:15 · BBC Scotland / Match of the Day · 22:25 · BBC One',
  );
  expect(foot).toHaveClass('font-sans', 'text-[9.5px]', 'uppercase', 'tracking-[.14em]',
    'text-muted', 'border-t', 'border-rule', 'pt-2');
});

test('no broadcasts tonight means no foot — the line is off, never invented', () => {
  renderClassified();
  expect(screen.queryByText(/Tonight —/)).toBeNull();
});
