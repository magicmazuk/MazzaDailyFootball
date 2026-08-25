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
// PlayerSheet also scouts (spec §13.35) via a real react-query hook —
// stubbed here for the same no-QueryClientProvider reason as usePlayer.
vi.mock('./video.js', () => ({
  usePlayerVideos: vi.fn(() => ({ data: undefined, isLoading: false })),
  youtubeKey: vi.fn(() => null),
}));

import MatchRoom, { statSplit } from './MatchRoom.jsx';
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
  // Scoped to the score spans (text-[30px]) for the same reason as the live
  // test above: a plain '.tabular-nums' selector now also matches the match
  // line's tick labels (spec §13.23), which sit inside the header too.
  const headerScores = [...container.querySelector('header').querySelectorAll('[class*="text-[30px]"]')]
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
  // ST-D (spec §13.35): value-led cells — big number, caps label, then
  // shirt + SURNAME with breathing room above the name line.
  const cell = screen.getByTestId('standout-cell-Shots-Celtic');
  expect(cell.textContent).toContain('5');
  expect(cell.textContent).toContain('Shots');
  expect(cell.textContent).toContain('Maeda');
  expect(cell.textContent).not.toContain('Daizen Maeda'); // surname only in the cell
  expect(cell.querySelector('[data-testid="shirt-shape"]')).toBeTruthy();
  // The user asked for padding around the count above the name — pinned.
  expect(cell.querySelector('[data-testid="standout-name"]').className).toContain('mt-2');
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
  // fixture, so assert on the standout cell specifically rather than the
  // bare name, which would collide with that unrelated timeline row.
  expect(screen.queryByTestId('standout-cell-Shots-Celtic')).not.toBeInTheDocument();
});

// --- tappable player names / the peek sheet (spec §13.16) ---

test('a standout entry with a playerId on an ESPN comp is a button that opens the sheet', async () => {
  usePlayer.mockReturnValue({
    bio: { id: 'p1', name: 'Maeda', position: 'Forward', shirt: '9',
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

  const button = screen.getByRole('button', { name: 'Maeda' });
  // the row still reads the same sentence even though the name is now
  // nested inside a <button> (getByText's default direct-text-node match
  // doesn't reach across that boundary, so this checks the row's full
  // textContent directly instead).
  const cell = button.closest('[data-testid^="standout-cell"]');
  expect(cell.textContent).toContain('5');
  expect(cell.textContent).toContain('Shots');
  await userEvent.click(button);
  expect(screen.getByText('Full profile →')).toBeInTheDocument();
});

test('a standout entry with no playerId stays plain text, not a button', () => {
  const standoutsDetail = { ...detail, standouts: standoutsData };
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={standoutsDetail} />
  </MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'Maeda' })).not.toBeInTheDocument();
  const cell = screen.getByTestId('standout-cell-Shots-Celtic');
  expect(cell.textContent).toContain('Maeda'); // plain text, not a button
});

test('a standout entry with a playerId on a BBC comp stays plain text (no player data at all)', () => {
  const bbcFixture = { ...fixture, compId: 'scottish-league-one' };
  const withId = [{ ...standoutsData[0], entries: [{ ...standoutsData[0].entries[0], playerId: 'p1' }] }];
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...bbcFixture, status: 'ft' }} comp={byId('scottish-league-one')}
      detail={{ ...detail, standouts: withId }} />
  </MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'Maeda' })).not.toBeInTheDocument();
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

test('each lineup row renders a Shirt in its side\'s colour, number on the chest', () => {
  const colouredFixture = { ...fixture,
    home: { ...fixture.home, colour: '009921' },
    away: { ...fixture.away, colour: 'C8142F' } };
  const lineupDetail = { ...detail, lineups: [
    { homeAway: 'home', players: [{ id: 'p2', name: 'Reo Hatate', shirt: '42', starter: true, position: 'MF' }] },
    { homeAway: 'away', players: [{ id: 'p4', name: 'James Tavernier', shirt: '2', starter: true, position: 'DF' }] },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={colouredFixture} comp={byId('sco.1')} detail={lineupDetail} />
  </MemoryRouter>);
  const shirts = screen.getAllByTestId('shirt-shape');
  expect(shirts[0]).toHaveAttribute('fill', '#009921');
  expect(shirts[1]).toHaveAttribute('fill', '#C8142F');
  // Number is scoped to each shirt's own svg (not screen-wide) since the
  // scoreline header can coincidentally render the same digit as a score.
  expect(shirts[0].closest('svg').textContent).toBe('42');
  expect(shirts[1].closest('svg').textContent).toBe('2');
});

test('a side with no colour renders the Shirt fallback fill', () => {
  const lineupDetail = { ...detail, lineups: [
    { homeAway: 'home', players: [{ id: 'p2', name: 'Reo Hatate', shirt: '42', starter: true, position: 'MF' }] },
    { homeAway: 'away', players: [] },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={lineupDetail} />
  </MemoryRouter>);
  expect(screen.getByTestId('shirt-shape')).toHaveAttribute('fill', '#F4F0E7');
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
  // The drawer's ledger form (spec §13.26), not prose: crest-score-crest.
  expect(screen.queryByText(/Rangers 1–2 Celtic/)).not.toBeInTheDocument();
  const row = screen.getByTestId('meeting-row');
  expect(row.textContent).toContain('1–2');
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

// --- motion (spec §13.21): the room's top-level sections rise in on mount,
// one static delay class per named slot, capped at rise-in-5. The video
// card is excluded — it owns its own .xfade-in (item 3), and stacking
// .rise-in on the same element would fight it over the `animation`
// shorthand rather than combine. ---

test('the room\'s sections carry staggered .rise-in classes, capped at rise-in-5; the video card is excluded', () => {
  const h2hDetail = { ...detail, headToHead: {
    meetings: [{ date: '2026-02-15T14:00:00Z', homeName: 'Rangers', awayName: 'Celtic', homeScore: 1, awayScore: 2 }],
  } };
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={h2hDetail} videos={videos} />
  </MemoryRouter>);

  const header = container.querySelector('header');
  const timeline = screen.getByText('The match').closest('section');
  const stats = screen.getByText('Stats').closest('section');
  const h2h = screen.getByText('Head to head').closest('section');
  const videoSection = screen.getByText('Video').closest('section');

  expect(header).toHaveClass('rise-in', 'rise-in-1');
  expect(timeline).toHaveClass('rise-in', 'rise-in-3');
  expect(stats).toHaveClass('rise-in', 'rise-in-4');
  expect(h2h).toHaveClass('rise-in', 'rise-in-5');
  expect(videoSection.className).not.toMatch(/rise-in/);
  expect(videoSection).toHaveClass('xfade-in');
});

// --- the match line in the heading (spec §13.23) — the goal-dot axis from
// the results drawer, reused on the fixture page directly under the match
// meta. Gated on the heading's own showScore rule (live || ft) AND on
// detail actually having been published, so a finished-but-undetailed
// fixture never paints a bare axis that would read as a 0-0.
const goalDetail = {
  ...detail,
  events: [
    { minute: "23'", type: 'Goal', player: 'Daizen Maeda', teamId: 'Celtic', scoringPlay: true },
    { minute: "35'", type: 'Goal', player: 'James Tavernier', teamId: 'Rangers', scoringPlay: true },
    { minute: "78'", type: 'Yellow Card', player: 'Reo Hatate', teamId: 'Celtic' },
  ],
  gameInfo: { venue: 'Celtic Park', attendance: 58914, referee: 'W Collum' },
};

test('the match line renders inside the heading, directly after the match meta', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={goalDetail} />
  </MemoryRouter>);
  const header = container.querySelector('header');
  const axis = header.querySelector('[data-testid="match-axis"]');
  expect(axis).toBeInTheDocument();
  // Ordering, not mere presence: the meta line must precede the axis.
  const meta = [...header.querySelectorAll('p')].find(p => p.textContent.includes('Celtic Park'));
  expect(meta).toBeTruthy();
  expect(meta.compareDocumentPosition(axis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('the match line plots one dot per scoring play, crediting each to its own side', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={goalDetail} />
  </MemoryRouter>);
  const dots = container.querySelector('header').querySelectorAll('[data-testid="goal-dot"]');
  expect(dots).toHaveLength(2);
  expect([...dots].map(d => d.dataset.side)).toEqual(['home', 'away']);
});

test('a live match shows the match line too, filling as goals land', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={goalDetail} />
  </MemoryRouter>);
  expect(container.querySelector('[data-testid="match-axis"]')).toBeInTheDocument();
});

test('a scheduled fixture renders no match line — a bare axis would read as 0-0', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'scheduled', minute: null }}
      comp={byId('sco.1')} detail={goalDetail} />
  </MemoryRouter>);
  expect(container.querySelector('[data-testid="match-axis"]')).not.toBeInTheDocument();
});

test('a finished fixture with no published detail renders no match line, not a phantom 0-0', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, compId: 'scottish-league-one', status: 'ft' }}
      comp={byId('scottish-league-one')} detail={null} />
  </MemoryRouter>);
  expect(container.querySelector('[data-testid="match-axis"]')).not.toBeInTheDocument();
});

test('a genuine published 0-0 renders the bare axis with no dots — the axis IS the story', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft', home: side('Celtic', 0), away: side('Rangers', 0) }}
      comp={byId('sco.1')} detail={{ ...goalDetail, events: [] }} />
  </MemoryRouter>);
  expect(container.querySelector('[data-testid="match-axis"]')).toBeInTheDocument();
  expect(container.querySelectorAll('[data-testid="goal-dot"]')).toHaveLength(0);
});

// --- the split rule (S-A, spec §13.24) — the stat rows' hairlines carry the
// two clubs' proportional shares, meeting at a 1px ink tick; the possession
// bar joins the same family. 0-0 keeps today's plain rule: no story, no split.
test('statSplit: home share of the combined count, from ESPN string values', () => {
  expect(statSplit('15', '6')).toBeCloseTo(71.43, 1);
  expect(statSplit('12', '14')).toBeCloseTo(46.15, 1);
});

test('statSplit: 0-0 yields null — the row keeps its plain rule', () => {
  expect(statSplit('0', '0')).toBeNull();
});

test('statSplit: a shutout pins the split to the edge — 1-0 is 100, 0-3 is 0', () => {
  expect(statSplit('1', '0')).toBe(100);
  expect(statSplit('0', '3')).toBe(0);
});

test('statSplit: missing or unparseable values yield null, not NaN', () => {
  expect(statSplit(undefined, '3')).toBeNull();
  expect(statSplit('abc', '3')).toBeNull();
});

const splitDetail = {
  ...detail,
  teamStats: [
    { teamId: 'Celtic', name: 'Celtic', stats: { possessionPct: '54', totalShots: '15', redCards: '0', saves: '1' } },
    { teamId: 'Rangers', name: 'Rangers', stats: { possessionPct: '46', totalShots: '6', redCards: '0', saves: '0' } },
  ],
};
const colourFixture = {
  ...fixture,
  home: { ...fixture.home, colour: '009933' },
  away: { ...fixture.away, colour: '1B458F' },
};

test('every scoring stat row and the possession bar carry a split rule with the tick at the home share', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={colourFixture} comp={byId('sco.1')} detail={splitDetail} />
  </MemoryRouter>);
  // possession (54), shots (71.43), saves (100) — red cards 0-0 gets none.
  const ticks = screen.getAllByTestId('split-tick');
  expect(ticks).toHaveLength(3);
  expect(ticks.map(t => parseFloat(t.style.left))).toEqual([
    expect.closeTo(54, 1), expect.closeTo(71.43, 1), expect.closeTo(100, 1),
  ]);
  // Boundaries ease to 60% ink (SOFT-75 round) — never full black, never gone.
  ticks.forEach(t => expect(t.className).toContain('bg-ink/60'));
});

test('a 0-0 stat row keeps the plain hairline and gains no split rule', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={colourFixture} comp={byId('sco.1')} detail={splitDetail} />
  </MemoryRouter>);
  const row = screen.getByText('Red cards').closest('div').parentElement;
  expect(row.querySelector('[data-testid="split-rule"]')).toBeNull();
  expect(row.className).toContain('border-b');
});

test('split segments paint the club colours inline', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={colourFixture} comp={byId('sco.1')} detail={splitDetail} />
  </MemoryRouter>);
  const home = screen.getAllByTestId('split-home')[0];
  const away = screen.getAllByTestId('split-away')[0];
  // The 75% press tone (spec §13.24, SOFT-75): colour sits IN the paper.
  expect(home.style.background).toMatch(/0\.75/);
  expect(away.style.background).toMatch(/0\.75/);
  expect(home.className).not.toContain('bg-muted');
});

test('a side with no feed colour falls back to the muted tone, same as the goal dots', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={splitDetail} />
  </MemoryRouter>);
  expect(screen.getAllByTestId('split-home')[0].className).toContain('bg-muted');
  expect(screen.getAllByTestId('split-away')[0].className).toContain('bg-muted');
});

// --- the lineups take the field (spec §13.25, L-B): side-by-side XIs —
// home ALWAYS the left column regardless of feed order — behind the
// centre-circle-and-half-way-line mark. All eleven render by default
// (never an accordion); names keep to one line, truncating with an
// ellipsis rather than wrapping — the tap is how you reach the full
// player, so tappability is part of the contract.
const XI = (prefix, n = 11) => Array.from({ length: n }, (_, i) => ({
  id: `${prefix}${i + 1}`, name: `${prefix} Player ${i + 1}`, shirt: String(i + 1),
  starter: true, position: 'MF',
}));

test('lineup columns sit side by side with home on the left, even when the feed sends away first', () => {
  const lineupDetail = { ...detail, lineups: [
    { homeAway: 'away', players: XI('Away') },
    { homeAway: 'home', players: XI('Home') },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={lineupDetail} />
  </MemoryRouter>);
  const home = screen.getByTestId('lineup-col-home');
  const away = screen.getByTestId('lineup-col-away');
  expect(home.parentElement).toBe(away.parentElement);
  expect(home.parentElement.className).toContain('grid-cols-2');
  expect(home.compareDocumentPosition(away) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(home.textContent).toContain('Home Player 1');
  expect(away.textContent).toContain('Away Player 11');
});

test('all eleven starters render per side — substitutes stay out, nothing collapses', () => {
  const lineupDetail = { ...detail, lineups: [
    { homeAway: 'home', players: [...XI('Home'), { id: 'sub1', name: 'A Substitute', shirt: '20', starter: false, position: 'FW' }] },
    { homeAway: 'away', players: XI('Away') },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={lineupDetail} />
  </MemoryRouter>);
  expect(screen.getByTestId('lineup-col-home').querySelectorAll('svg').length).toBe(11);
  expect(screen.getByTestId('lineup-col-away').querySelectorAll('svg').length).toBe(11);
  expect(screen.queryByText('A Substitute')).not.toBeInTheDocument();
});

test('lineup names keep to one truncating line and stay tappable', () => {
  const lineupDetail = { ...detail, lineups: [
    { homeAway: 'home', players: [{ id: 'p9', name: 'Michael Schjonning-Larsen', shirt: '8', starter: true, position: 'MF' }] },
    { homeAway: 'away', players: [] },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={lineupDetail} />
  </MemoryRouter>);
  const tap = screen.getByRole('button', { name: 'Michael Schjonning-Larsen' });
  expect(tap.className).toContain('truncate');
});

test('the pitch mark draws behind the columns — decorative, never interactive', () => {
  const lineupDetail = { ...detail, lineups: [
    { homeAway: 'home', players: XI('Home') },
    { homeAway: 'away', players: XI('Away') },
  ] };
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={lineupDetail} />
  </MemoryRouter>);
  const pitch = container.querySelector('[data-testid="lineup-pitch"]');
  expect(pitch).toBeInTheDocument();
  expect(pitch.getAttribute('aria-hidden')).toBe('true');
  expect(pitch.className).toContain('pointer-events-none');
  expect(pitch.querySelector('circle')).toBeTruthy();
});

test('no lineups means no pitch — the mark never draws over an empty section', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={{ ...detail, lineups: [] }} />
  </MemoryRouter>);
  expect(container.querySelector('[data-testid="lineup-pitch"]')).toBeNull();
});

// --- review round (spec §13.24-25 hardening): the degraded-case law applies
// to the new graphics too — no split, bar, or column may ever assert data
// the feed did not publish.
test('statSplit: empty-string values are unknown, not zero', () => {
  expect(statSplit('', '3')).toBeNull();
  expect(statSplit('5', '')).toBeNull();
});

test('an unparseable or both-zero possession renders no bar — never a fabricated 100% side', () => {
  const weird = { ...detail, teamStats: [
    { teamId: 'Celtic', name: 'Celtic', stats: { possessionPct: '58%', totalShots: '14' } },
    { teamId: 'Rangers', name: 'Rangers', stats: { possessionPct: '', totalShots: '9' } },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={weird} />
  </MemoryRouter>);
  expect(screen.queryByText('Possession')).not.toBeInTheDocument();
});

test('a missing away possession renders no bar — no invented remainder share', () => {
  const halfPoss = { ...detail, teamStats: [
    { teamId: 'Celtic', name: 'Celtic', stats: { possessionPct: '54', totalShots: '14' } },
    { teamId: 'Rangers', name: 'Rangers', stats: { totalShots: '9' } },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={halfPoss} />
  </MemoryRouter>);
  expect(screen.queryByText('Possession')).not.toBeInTheDocument();
});

test('an away-only lineup feed never renders the away XI under the home club', () => {
  const awayOnly = { ...detail, lineups: [
    { homeAway: 'away', players: XI('Away') },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={awayOnly} />
  </MemoryRouter>);
  const home = screen.getByTestId('lineup-col-home');
  expect(home.textContent).not.toContain('Away Player');
  // The degraded-case law: the unpublished side says so in one line, never blank.
  expect(home.textContent).toContain('XI not yet published.');
  expect(screen.getByTestId('lineup-col-away').textContent).toContain('Away Player 1');
});

test('lineup entries with no homeAway attribution render nothing rather than a guessed column', () => {
  const unattributed = { ...detail, lineups: [
    { homeAway: null, players: XI('Mystery') },
  ] };
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={unattributed} />
  </MemoryRouter>);
  expect(screen.queryByText(/Mystery Player/)).not.toBeInTheDocument();
  expect(container.querySelector('[data-testid="lineup-pitch"]')).toBeNull();
});

test('the pitch mark takes the rule token via currentColor, never a frozen hex', () => {
  const lineupDetail = { ...detail, lineups: [
    { homeAway: 'home', players: XI('Home') },
    { homeAway: 'away', players: XI('Away') },
  ] };
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={lineupDetail} />
  </MemoryRouter>);
  const pitch = container.querySelector('[data-testid="lineup-pitch"]');
  expect(pitch.querySelector('svg').getAttribute('class')).toContain('text-rule');
  expect(pitch.querySelector('circle').getAttribute('stroke')).toBe('currentColor');
});

test('a malformed feed colour falls back to muted rather than painting an invalid fill', () => {
  const shortHex = { ...fixture,
    home: { ...fixture.home, colour: 'fff' }, away: { ...fixture.away, colour: '1B458F' } };
  render(<MemoryRouter>
    <MatchRoom fixture={shortHex} comp={byId('sco.1')} detail={splitDetail} />
  </MemoryRouter>);
  const home = screen.getAllByTestId('split-home')[0];
  expect(home.className).toContain('bg-muted');
  expect(home.style.background).toBe('');
});

test('a starters-free roster (subs only, pre-announcement) renders no lineups section at all', () => {
  const subsOnly = { ...detail, lineups: [
    { homeAway: 'home', players: [{ id: 's1', name: 'A Sub', shirt: '20', starter: false, position: 'FW' }] },
    { homeAway: 'away', players: [] },
  ] };
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={subsOnly} />
  </MemoryRouter>);
  expect(container.querySelector('[data-testid="lineup-pitch"]')).toBeNull();
  expect(screen.queryByTestId('lineup-col-home')).not.toBeInTheDocument();
});

test('team stats whose ids match neither side render no stats — colours must never mis-attribute', () => {
  const driftedIds = { ...detail, teamStats: [
    { teamId: 'someone-else', name: 'X', stats: { possessionPct: '60', totalShots: '9' } },
    { teamId: 'another', name: 'Y', stats: { possessionPct: '40', totalShots: '4' } },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={driftedIds} />
  </MemoryRouter>);
  expect(screen.queryByText('Stats')).not.toBeInTheDocument();
});

test('the match page head-to-head shows ALL meetings most-recent-first with the balance beneath', () => {
  const h2hDetail = { ...detail, headToHead: { meetings: [
    { date: '2025-11-02T15:00:00Z', homeName: 'Rangers', awayName: 'Celtic', homeScore: 0, awayScore: 3 },
    { date: '2026-02-15T14:00:00Z', homeName: 'Rangers', awayName: 'Celtic', homeScore: 1, awayScore: 2 },
    { date: '2026-01-02T14:00:00Z', homeName: 'Celtic', awayName: 'Rangers', homeScore: 2, awayScore: 2 },
    { date: '2025-09-01T14:00:00Z', homeName: 'Celtic', awayName: 'Rangers', homeScore: 1, awayScore: 0 },
  ] } };
  const colours = { ...fixture,
    home: { ...fixture.home, colour: '009933' }, away: { ...fixture.away, colour: '1B458F' } };
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={colours} comp={byId('sco.1')} detail={h2hDetail} />
  </MemoryRouter>);
  const section = screen.getByText('Head to head').closest('section');
  const rows = section.querySelectorAll('[data-testid="meeting-row"]');
  expect(rows).toHaveLength(4); // all of them — the match page is the deep view
  // Most recent (15 Feb) first, oldest (1 Sep) last.
  expect(rows[0].textContent).toContain('1–2');
  expect(rows[3].textContent).toContain('1–0');
  // The balance rides beneath in the split-rule theme, over ALL shown meetings:
  // Celtic 3 wins (incl. the fixture-home flip), 1 draw, 0 Rangers wins.
  expect(section.querySelector('[data-testid="balance-seg-home"]')).toBeTruthy();
  expect(section.querySelectorAll('[data-testid="balance-tick"]').length).toBeGreaterThan(0);
  expect(screen.getByText('Celtic 3')).toBeInTheDocument();
  expect(screen.getByText('drawn 1')).toBeInTheDocument();
  expect(screen.getByText('Rangers 0')).toBeInTheDocument();
});

// --- two-legged ties on the match page (spec §13.29): the tie's verdict in
// the heading, and the other leg one tap away.
const legFixture = { ...fixture, status: 'ft', compId: 'uefa.champions',
  round: 'third-qualifying-round', leg: 2, tieCompleted: true, tieWinnerId: 'Rangers',
  home: { ...side('Celtic', 1), agg: 1 }, away: { ...side('Rangers', 0), agg: 2 } };
const firstLeg = { id: 'e0', compId: 'uefa.champions', round: 'third-qualifying-round',
  kickoff: '2026-08-12T18:45:00Z', status: 'ft', leg: 1,
  home: { ...side('Rangers', 2), agg: null }, away: { ...side('Celtic', 0), agg: null } };

test("the heading prints the tie's verdict beside the leg score it contradicts", () => {
  render(<MemoryRouter>
    <MatchRoom fixture={legFixture} comp={byId('uefa.champions')} detail={null} />
  </MemoryRouter>);
  expect(screen.getByText('Rangers through 2–1 on aggregate')).toBeInTheDocument();
});

test('the other leg renders as a linked line in the heading, and navigates by id', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={legFixture} comp={byId('uefa.champions')} detail={null}
      otherLeg={firstLeg} />
  </MemoryRouter>);
  const link = container.querySelector('[data-testid="leg-link"]');
  expect(link.textContent).toContain('1st leg');
  expect(link.textContent).toContain('2–0');
  expect(link.getAttribute('href')).toBe('/match/uefa.champions/e0');
});

test('no tie, no lines — an ordinary match heading is untouched', () => {
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, status: 'ft' }} comp={byId('sco.1')} detail={null} />
  </MemoryRouter>);
  expect(screen.queryByText(/on aggregate/)).not.toBeInTheDocument();
  expect(container.querySelector('[data-testid="leg-link"]')).toBeNull();
});

test("the page kicker names the leg beside the competition and round", () => {
  render(<MemoryRouter>
    <MatchRoom fixture={legFixture} comp={byId('uefa.champions')} detail={null} />
  </MemoryRouter>);
  const kicker = screen.getByText('UEFA Champions League').closest('p');
  expect(kicker.textContent).toContain('· 2nd leg');
});

test("an unplayed other leg never renders a link — a scheduled leg's phantom 0-0 reads as a finished goalless game", () => {
  const scheduledSecondLeg = { ...firstLeg, id: 'e2', leg: 2, status: 'scheduled',
    kickoff: '2026-08-26T19:00:00Z',
    home: { ...side('Rangers', 0), agg: null }, away: { ...side('Celtic', 0), agg: null } };
  const firstLegPage = { ...legFixture, leg: 1, tieCompleted: false, tieWinnerId: null };
  const { container } = render(<MemoryRouter>
    <MatchRoom fixture={firstLegPage} comp={byId('uefa.champions')} detail={null}
      otherLeg={scheduledSecondLeg} />
  </MemoryRouter>);
  expect(container.querySelector('[data-testid="leg-link"]')).toBeNull();
});

// --- the degraded line breathes (spec §13.32): a bare unmargined <p> let
// "That day" land on its shoulder on junior/BBC match pages.
test('the no-detail line carries the section rhythm so the next label never squashes against it', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, compId: 'wosfl.first', status: 'ft' }}
      comp={byId('wosfl.first')} detail={null} />
  </MemoryRouter>);
  const line = screen.getByText(/Detailed stats aren't published/);
  expect(line.className).toContain('mb-8');
});
