import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MatchRoom from './MatchRoom.jsx';
import { byId } from '../../domain/competitions.js';

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
  const headerScores = [...container.querySelector('header').querySelectorAll('.tabular-nums')]
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

test('the kicker appends the prettified round for a knockout fixture', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, round: 'fourth-round' }} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.getByText('Scottish Premiership · Fourth round')).toBeInTheDocument();
});

test('the kicker has no round suffix for a regular-season fixture', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, round: 'regular-season' }} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.getByText('Scottish Premiership')).toBeInTheDocument();
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

// --- standouts (post-match) ---

test('standouts render per side when present', () => {
  const standoutsDetail = { ...detail, standouts: [
    { teamId: 'Celtic', teamName: 'Celtic', entries: [
      { label: 'Shots', player: 'Daizen Maeda', value: '5' },
    ] },
    { teamId: 'Rangers', teamName: 'Rangers', entries: [
      { label: 'Saves', player: 'Jack Butland', value: '4' },
    ] },
  ] };
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={standoutsDetail} />
  </MemoryRouter>);
  expect(screen.getByText(/Shots: Daizen Maeda 5/)).toBeInTheDocument();
  expect(screen.getByText(/Saves: Jack Butland 4/)).toBeInTheDocument();
});

test('standouts section is absent without data', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.queryByText('Standouts')).not.toBeInTheDocument();
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
