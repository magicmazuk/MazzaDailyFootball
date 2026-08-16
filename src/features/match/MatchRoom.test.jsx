import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

// PlayerSheet (mounted at MatchRoom's root, spec §13.16) fetches via
// usePlayer internally — mocked here so these tests don't need a
// QueryClientProvider. Vitest resolves this to the same physical
// src/data/queries.js module PlayerSheet itself imports, regardless of
// each file's own relative path to it, so this single mock covers both.
vi.mock('../../data/queries.js', () => ({
  usePlayer: vi.fn(() => ({ bio: null, stats: null, isLoading: false, isError: false })),
}));

import MatchRoom from './MatchRoom.jsx';
import { byId } from '../../domain/competitions.js';
import { usePlayer } from '../../data/queries.js';

// usePlayer is a shared mock across every test in this file — reset to the
// closed-sheet default before each one so a test that opens the sheet with
// real bio/stats can't leak that data into a later, unrelated test.
beforeEach(() => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: false });
});

const side = (name, score) => ({ teamId: name, name, shortName: name,
  crestUrl: null, monogram: name.slice(0, 2).toUpperCase(), colour: null, score });
const fixture = {
  id: 'e1', compId: 'sco.1', kickoff: '2026-08-22T14:00:00Z', status: 'live',
  minute: "67'", round: null, venue: 'Celtic Park',
  home: side('Celtic', 2), away: side('Rangers', 1),
};

const detail = {
  events: [
    { minute: "67'", type: 'Goal', player: 'Daizen Maeda', teamId: 'Celtic' },
    { minute: "54'", type: 'Yellow Card', player: 'James Tavernier', teamId: 'Rangers' },
  ],
  teamStats: [
    { teamId: 'Celtic', name: 'Celtic', stats: { possessionPct: '58', totalShots: '14' } },
    { teamId: 'Rangers', name: 'Rangers', stats: { possessionPct: '42', totalShots: '9' } },
  ],
  lineups: [],
};

test('renders the scoreline, minute and timeline moments', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.getByText('Celtic')).toBeInTheDocument();
  expect(screen.getAllByText(/2|1/).length).toBeGreaterThan(0);
  // "67'" appears twice — the live minute in the header and the goal in the timeline
  expect(screen.getAllByText("67'").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('Daizen Maeda')).toBeInTheDocument();
  expect(screen.getByText('Yellow Card')).toBeInTheDocument();
});

test('renders team stats when present', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.getByText('Possession')).toBeInTheDocument();
  expect(screen.getByText('58%')).toBeInTheDocument();
});

test('renders team stats correctly even with away-first array order', () => {
  const detailAwayFirst = {
    ...detail,
    teamStats: [
      { teamId: 'Rangers', name: 'Rangers', stats: { possessionPct: '42', totalShots: '9' } },
      { teamId: 'Celtic', name: 'Celtic', stats: { possessionPct: '58', totalShots: '14' } },
    ],
  };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detailAwayFirst} />
  </MemoryRouter>);
  expect(screen.getByText('Possession')).toBeInTheDocument();
  // Verify home possession (58%) appears on the left
  const possessionRow = screen.getByText('Possession').closest('div');
  const stats = possessionRow.parentElement.querySelectorAll('.tabular-nums');
  expect(stats[0].textContent).toBe('58%');
  expect(stats[1].textContent).toBe('42%');
});

test('a live fixture overlays the fresher summary score onto the header, not the stale cached one', () => {
  const liveDetail = {
    ...detail,
    liveScore: { home: { teamId: 'Celtic', score: 3 }, away: { teamId: 'Rangers', score: 1 } },
  };
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={liveDetail} />
  </MemoryRouter>);
  // fixture itself says 2-1 (stale cache); the summary header says 3-1.
  // Scoped to the score spans specifically (text-[30px]) — a plain
  // '.tabular-nums' selector also now matches the live-minute span
  // (StatusWord, gold sweep: tabular-nums added there too).
  const headerScores = [...container.querySelector('header').querySelectorAll('[class*="text-[30px]"]')]
    .map(el => el.textContent);
  expect(headerScores).toEqual(['3', '1']);
});

test('a non-live fixture ignores liveScore even if present, and falls back to fixture scores', () => {
  const ftFixture = { ...fixture, status: 'ft' };
  const liveDetail = {
    ...detail,
    liveScore: { home: { teamId: 'Celtic', score: 9 }, away: { teamId: 'Rangers', score: 9 } },
  };
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={ftFixture} comp={byId('sco.1')} detail={liveDetail} />
  </MemoryRouter>);
  const headerScores = [...container.querySelector('header').querySelectorAll('.tabular-nums')]
    .map(el => el.textContent);
  expect(headerScores).toEqual(['2', '1']);
});

test('a penalty shootout renders a quiet winner line under the status', () => {
  const pensFixture = {
    ...fixture, status: 'ft',
    home: { ...fixture.home, penaltyScore: 4 },
    away: { ...fixture.away, penaltyScore: 3 },
  };
  render(<MemoryRouter>
    <MatchRoom fixture={pensFixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.getByText('Celtic win 4–3 on penalties')).toBeInTheDocument();
});

test('the away side can win the shootout too, and no line renders without both penalty scores', () => {
  const awayWins = {
    ...fixture, status: 'ft',
    home: { ...fixture.home, penaltyScore: 2 },
    away: { ...fixture.away, penaltyScore: 5 },
  };
  const { unmount } = render(<MemoryRouter>
    <MatchRoom fixture={awayWins} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.getByText('Rangers win 5–2 on penalties')).toBeInTheDocument();
  unmount();

  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.queryByText(/on penalties/)).not.toBeInTheDocument();
});

test('BBC competitions get the honest degraded line, not empty shelves', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, compId: 'scottish-league-one' }}
      comp={byId('scottish-league-one')} detail={null} />
  </MemoryRouter>);
  expect(screen.getByText("Detailed stats aren't published for Scottish League One."))
    .toBeInTheDocument();
});

test('a scheduled fixture with ESPN\'s phantom score:"0" shows a dash, not 0-0', () => {
  const scheduledFixture = { ...fixture, status: 'scheduled', minute: null,
    home: side('Celtic', 0), away: side('Rangers', 0) };
  render(<MemoryRouter>
    <MatchRoom fixture={scheduledFixture} comp={byId('sco.1')} detail={null} />
  </MemoryRouter>);
  expect(screen.getAllByText('–')).toHaveLength(2);
  expect(screen.queryByText('0')).not.toBeInTheDocument();
});

test('score header sides link to team pages and tv renders', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, tv: ['TNT Sports'] }} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  const links = screen.getAllByRole('link');
  expect(links.some(l => l.getAttribute('href') === '/team/sco.1/Celtic')).toBe(true);
  expect(links.some(l => l.getAttribute('href') === '/team/sco.1/Rangers')).toBe(true);
  expect(screen.getByText('TNT')).toBeInTheDocument();
});

// --- kicker: round prettifier wiring (spec §13.8) ---

// The kicker's competition name is now a Link (spec §13.13); the round
// suffix stays plain text outside it, so the two live in separate DOM
// text nodes. Assert on the kicker <p>'s full textContent (recursive)
// rather than screen.getByText, whose default node-text matcher only
// looks at a node's own direct text-node children.
test('the kicker appends the prettified round for a knockout fixture', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, round: 'fourth-round' }} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(container.querySelector('main > p').textContent).toBe('Scottish Premiership · Fourth round');
});

test('the kicker has no round suffix for a regular-season fixture', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, round: 'regular-season' }} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(container.querySelector('main > p').textContent).toBe('Scottish Premiership');
});

// --- kicker: competition link (spec §13.13) ---

test('the kicker competition name is a link to the competition page; the round text stays plain', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, round: 'fourth-round' }} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  const link = screen.getByRole('link', { name: 'Scottish Premiership' });
  expect(link).toHaveAttribute('href', '/competition/sco.1');
  // 'Fourth round' is not itself part of any link.
  expect(screen.getByText(/Fourth round/).closest('a')).toBeNull();
});

// --- date line ---

test('the date line shows the full en-GB date under the kicker', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  // fixture.kickoff is 2026-08-22, a Saturday
  expect(screen.getByText(/Saturday,? 22 August 2026/)).toBeInTheDocument();
});

// --- metadata line (venue · attendance · referee) ---

test('the metadata line renders venue, attendance and referee from gameInfo', () => {
  const gameInfoDetail = { ...detail, gameInfo: {
    venue: 'Hampden Park', attendance: 8353, referee: 'Nick Walsh',
  } };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={gameInfoDetail} />
  </MemoryRouter>);
  expect(screen.getByText('Hampden Park · 8,353 · Nick Walsh')).toBeInTheDocument();
});

test('the metadata line falls back to fixture.venue when gameInfo carries none', () => {
  const gameInfoDetail = { ...detail, gameInfo: { venue: null, attendance: null, referee: 'Nick Walsh' } };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={gameInfoDetail} />
  </MemoryRouter>);
  // fixture.venue is 'Celtic Park'; only the parts that exist are joined
  expect(screen.getByText('Celtic Park · Nick Walsh')).toBeInTheDocument();
});

test('the metadata line is absent when gameInfo is absent', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.queryByText(/Nick Walsh|Hampden Park|Celtic Park/)).not.toBeInTheDocument();
});

// --- form coming in ---

test('the form block renders five glyphs per side when form is present for both teams', () => {
  const formDetail = { ...detail, form: {
    Celtic: ['W', 'W', 'D', 'W', 'L'],
    Rangers: ['L', 'D', 'W', 'W', 'W'],
  } };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={formDetail} />
  </MemoryRouter>);
  expect(screen.getAllByText(/^[WDL]$/)).toHaveLength(10);
});

test('the form block is absent unless both sides have form', () => {
  const formDetail = { ...detail, form: { Celtic: ['W', 'W', 'D', 'W', 'L'] } };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={formDetail} />
  </MemoryRouter>);
  expect(screen.queryAllByText(/^[WDL]$/)).toHaveLength(0);
});

// --- timeline: upgraded moments ---

test('a plain goal shows just the scorer\'s name, with no redundant type word', () => {
  const goalDetail = { ...detail, events: [
    { minute: "67'", type: 'Goal', player: 'Daizen Maeda', playerOff: null,
      teamId: 'Celtic', scoringPlay: true },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={goalDetail} />
  </MemoryRouter>);
  expect(screen.getByText('Daizen Maeda')).toBeInTheDocument();
  expect(screen.queryByText('Goal')).not.toBeInTheDocument();
});

test('a qualified goal (e.g. an own goal) keeps its type word alongside the scorer', () => {
  const ownGoalDetail = { ...detail, events: [
    { minute: "30'", type: 'Own Goal', player: 'Connor Goldson', playerOff: null,
      teamId: 'Rangers', scoringPlay: true },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={ownGoalDetail} />
  </MemoryRouter>);
  expect(screen.getByText('Connor Goldson')).toBeInTheDocument();
  expect(screen.getByText('Own Goal')).toBeInTheDocument();
});

test('a substitution shows both names with on/off arrows, the outgoing name muted', () => {
  const subDetail = { ...detail, events: [
    { minute: "72'", type: 'Substitution', player: 'Luke McCowan', playerOff: 'Reo Hatate',
      teamId: 'Celtic', scoringPlay: false },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={subDetail} />
  </MemoryRouter>);
  expect(screen.getByText(/Luke McCowan/)).toBeInTheDocument();
  expect(screen.getByText(/↑/)).toBeInTheDocument();
  expect(screen.getByText(/Reo Hatate/)).toBeInTheDocument();
  expect(screen.getByText(/↓/)).toBeInTheDocument();
});

test('a yellow card row carries the player and a card tick element', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.getByText('James Tavernier')).toBeInTheDocument();
  expect(screen.getByTestId('card-yellow')).toBeInTheDocument();
});

test('an event with a null player still renders the type word, never a blank row', () => {
  const noPlayerDetail = { ...detail, events: [
    { minute: "45'", type: 'Half Time', player: null, playerOff: null,
      teamId: null, scoringPlay: false },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={noPlayerDetail} />
  </MemoryRouter>);
  expect(screen.getByText('Half Time')).toBeInTheDocument();
});

test('a timeline row shows the event team\'s crest when its teamId maps to a fixture side', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  // one Celtic crest in the score header, one more on the Celtic goal event row
  expect(container.querySelectorAll('[aria-label="Celtic"]').length).toBe(2);
});

// --- standouts (post-match only, spec §13.8 — ESPN publishes leaders even
// on a scheduled fixture, using season-to-date numbers that would mislead
// if shown before kickoff) ---

const standoutsData = [
  { teamId: 'Celtic', teamName: 'Celtic', entries: [
    { label: 'Shots', player: 'Daizen Maeda', value: '5' },
  ] },
  { teamId: 'Rangers', teamName: 'Rangers', entries: [
    { label: 'Saves', player: 'Jack Butland', value: '4' },
  ] },
];

test('standouts render per side on a full-time fixture', () => {
  const standoutsDetail = { ...detail, standouts: standoutsData };
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={standoutsDetail} />
  </MemoryRouter>);
  expect(screen.getByText(/Shots: Daizen Maeda 5/)).toBeInTheDocument();
  expect(screen.getByText(/Saves: Jack Butland 4/)).toBeInTheDocument();
});

test('standouts section is absent without data', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.queryByText('Standouts')).not.toBeInTheDocument();
});

test('standouts are withheld pre-match even when the source already publishes them', () => {
  const scheduledFixture = { ...fixture, status: 'scheduled', minute: null };
  const standoutsDetail = { ...detail, standouts: standoutsData };
  render(<MemoryRouter>
    <MatchRoom fixture={scheduledFixture} comp={byId('sco.1')} detail={standoutsDetail} />
  </MemoryRouter>);
  expect(screen.queryByText('Standouts')).not.toBeInTheDocument();
  // 'Daizen Maeda' also scores in the shared `detail.events` timeline
  // fixture, so assert on the formatted standout row specifically rather
  // than the bare name, which would collide with that unrelated timeline row.
  expect(screen.queryByText(/Shots: Daizen Maeda 5/)).not.toBeInTheDocument();
});

// --- tappable player names / the peek sheet (spec §13.16) ---

test('a standout entry with a playerId on an ESPN comp is a button that opens the sheet', async () => {
  usePlayer.mockReturnValue({
    bio: { id: 'p1', name: 'Daizen Maeda', position: 'Forward', shirt: '9',
      age: 27, nationality: 'Japan', heightDisplay: null, birthDate: null, birthPlace: null },
    stats: { appearances: 5, minutes: 450, goals: 5, assists: 0, shotsOnTarget: null,
      shotsOffTarget: null, totalShots: null, accuratePasses: null, inaccuratePasses: null,
      totalPasses: null, passPct: null, foulsCommitted: null, yellowCards: null, redCards: null,
      effectiveTackles: null, saves: null, cleanSheets: null, goalsConceded: null, rating: 7.1 },
    isLoading: false, isError: false,
  });
  const withId = [{ ...standoutsData[0], entries: [{ ...standoutsData[0].entries[0], playerId: 'p1' }] },
    standoutsData[1]];
  const standoutsDetail = { ...detail, standouts: withId };
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={standoutsDetail} />
  </MemoryRouter>);

  const button = screen.getByRole('button', { name: 'Daizen Maeda' });
  // the row still reads the same sentence even though the name is now
  // nested inside a <button> (getByText's default direct-text-node match
  // doesn't reach across that boundary, so this checks the row's full
  // textContent directly instead).
  expect(button.closest('p').textContent).toBe('Shots: Daizen Maeda 5');
  await userEvent.click(button);
  expect(screen.getByText('Full profile →')).toBeInTheDocument();
});

test('a standout entry with no playerId stays plain text, not a button', () => {
  const standoutsDetail = { ...detail, standouts: standoutsData };
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={standoutsDetail} />
  </MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'Daizen Maeda' })).not.toBeInTheDocument();
  expect(screen.getByText(/Shots: Daizen Maeda 5/)).toBeInTheDocument();
});

test('a standout entry with a playerId on a BBC comp stays plain text (no player data at all)', () => {
  const bbcFixture = { ...fixture, compId: 'scottish-league-one' };
  const withId = [{ ...standoutsData[0], entries: [{ ...standoutsData[0].entries[0], playerId: 'p1' }] }];
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...bbcFixture, status: 'ft' }} comp={byId('scottish-league-one')}
      detail={{ ...detail, standouts: withId }} />
  </MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'Daizen Maeda' })).not.toBeInTheDocument();
});

test('a lineup player with an id on an ESPN comp is a tappable button', () => {
  const lineupDetail = { ...detail, lineups: [
    { homeAway: 'home', players: [{ id: 'p2', name: 'Reo Hatate', shirt: '42', starter: true, position: 'MF' }] },
    { homeAway: 'away', players: [] },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={lineupDetail} />
  </MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Reo Hatate' })).toBeInTheDocument();
});

test('a lineup player with no id stays plain text', () => {
  const lineupDetail = { ...detail, lineups: [
    { homeAway: 'home', players: [{ id: null, name: 'Reo Hatate', shirt: '42', starter: true, position: 'MF' }] },
    { homeAway: 'away', players: [] },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={lineupDetail} />
  </MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'Reo Hatate' })).not.toBeInTheDocument();
  expect(screen.getByText('Reo Hatate')).toBeInTheDocument();
});

test('a timeline goal-scorer with a playerId is tappable; the substitution\'s off-player never is', () => {
  const timelineDetail = { ...detail, events: [
    { minute: "67'", type: 'Goal', player: 'Daizen Maeda', playerId: 'p1', teamId: 'Celtic' },
    { minute: "72'", type: 'Substitution', player: 'Luke McCowan', playerId: 'p3',
      playerOff: 'Reo Hatate', playerOffId: 'p2', teamId: 'Celtic' },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={timelineDetail} />
  </MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Daizen Maeda' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Luke McCowan' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reo Hatate' })).not.toBeInTheDocument();
  expect(screen.getByText(/Reo Hatate/)).toBeInTheDocument();
});

// --- head-to-head ---

test('head-to-head renders past meetings and an optional summary line', () => {
  const h2hDetail = { ...detail, headToHead: {
    summary: 'Celtic lead the series 3-1',
    meetings: [
      { date: '2026-02-15T14:00:00Z', homeName: 'Rangers', awayName: 'Celtic',
        homeScore: 1, awayScore: 2 },
    ],
  } };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={h2hDetail} />
  </MemoryRouter>);
  expect(screen.getByText('Head to head')).toBeInTheDocument();
  expect(screen.getByText('Celtic lead the series 3-1')).toBeInTheDocument();
  expect(screen.getByText(/Rangers 1–2 Celtic/)).toBeInTheDocument();
});

test('head-to-head section is absent without meetings', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.queryByText('Head to head')).not.toBeInTheDocument();
});

// --- contextual match video (spec §13.9) ---

const videos = [{ videoId: 'abc123', title: 'Celtic 2-1 Rangers highlights' }];

test('the video card renders after head-to-head when videos are supplied', () => {
  const h2hDetail = { ...detail, headToHead: {
    meetings: [{ date: '2026-02-15T14:00:00Z', homeName: 'Rangers', awayName: 'Celtic',
      homeScore: 1, awayScore: 2 }],
  } };
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={h2hDetail}
      videos={videos} />
  </MemoryRouter>);
  expect(screen.getByText('Celtic 2-1 Rangers highlights')).toBeInTheDocument();
  const sectionLabels = [...container.querySelectorAll('h2')].map(h => h.textContent);
  expect(sectionLabels.indexOf('Head to head')).toBeLessThan(sectionLabels.indexOf('Video'));
});

test('no videos supplied renders no video card', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={detail}
      videos={[]} />
  </MemoryRouter>);
  expect(screen.queryByText('Video')).not.toBeInTheDocument();
});

test('the video card still renders in the BBC-degraded branch (no match detail) when videos are supplied', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, compId: 'scottish-league-one', status: 'ft' }}
      comp={byId('scottish-league-one')} detail={null} videos={videos} />
  </MemoryRouter>);
  expect(screen.getByText("Detailed stats aren't published for Scottish League One."))
    .toBeInTheDocument();
  expect(screen.getByText('Celtic 2-1 Rangers highlights')).toBeInTheDocument();
});

// --- round siblings (spec §13.13) ---

const siblingFixture = (id, home, away, over = {}) => ({
  id, compId: 'sco.1', kickoff: '2026-08-22T16:00:00Z', status: 'scheduled', minute: null,
  round: null, venue: null, home: side(home), away: side(away), ...over,
});

test('siblings render under "In this round" (fixture.round non-null), below the video card', () => {
  const siblings = [siblingFixture('s1', 'Hibernian', 'Hearts', { round: 'fourth-round' })];
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, round: 'fourth-round', status: 'ft' }} comp={byId('sco.1')}
      detail={detail} videos={videos} siblings={siblings} />
  </MemoryRouter>);
  expect(screen.getByText('In this round')).toBeInTheDocument();
  expect(screen.getByText('Hibernian')).toBeInTheDocument();
  expect(screen.getByText('Hearts')).toBeInTheDocument();
  // Sibling rows carry showContext={false} — sco.1's shortName ('Premiership')
  // must not appear a second time as a context line.
  expect(screen.queryByText('Premiership')).not.toBeInTheDocument();
  const sectionLabels = [...container.querySelectorAll('h2')].map(h => h.textContent);
  expect(sectionLabels.indexOf('Video')).toBeLessThan(sectionLabels.indexOf('In this round'));
});

test('siblings render under "That day" when the fixture carries no round', () => {
  const siblings = [siblingFixture('s1', 'Motherwell', 'Livingston')];
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, round: null }} comp={byId('sco.1')} detail={detail}
      siblings={siblings} />
  </MemoryRouter>);
  expect(screen.getByText('That day')).toBeInTheDocument();
  expect(screen.getByText('Motherwell')).toBeInTheDocument();
});

test('the siblings section is absent when there are none', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} siblings={[]} />
  </MemoryRouter>);
  expect(screen.queryByText('In this round')).not.toBeInTheDocument();
  expect(screen.queryByText('That day')).not.toBeInTheDocument();
});

test('the siblings section is absent when the prop is omitted entirely', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.queryByText('In this round')).not.toBeInTheDocument();
  expect(screen.queryByText('That day')).not.toBeInTheDocument();
});

// A followed club's sibling row shows its star (backlog, 2.2 review:
// siblings never received followedIds, so ★ never showed there).
test('a followed sibling club shows the star', () => {
  const siblings = [siblingFixture('s1', 'Hibernian', 'Hearts', { round: 'fourth-round' })];
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, round: 'fourth-round', status: 'ft' }} comp={byId('sco.1')}
      detail={detail} siblings={siblings} followedIds={new Set(['Hibernian'])} />
  </MemoryRouter>);
  expect(screen.getByText('★')).toBeInTheDocument();
});

test('siblings show no star when followedIds is omitted (defaults to empty)', () => {
  const siblings = [siblingFixture('s1', 'Hibernian', 'Hearts', { round: 'fourth-round' })];
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, round: 'fourth-round', status: 'ft' }} comp={byId('sco.1')}
      detail={detail} siblings={siblings} />
  </MemoryRouter>);
  expect(screen.queryByText('★')).not.toBeInTheDocument();
});
