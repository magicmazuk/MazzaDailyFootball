import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import TodayView from './TodayView.jsx';
import { byId } from '../../domain/competitions.js';

// TodayView renders Papers (The papers, spec §13.19.2), which fetches its
// own news via useNews — stub it so these presentational tests need no
// QueryClientProvider and stay focused on TodayView's own layout/ordering.
vi.mock('../../data/queries.js', () => ({
  useNews: vi.fn(() => ({ isLoading: false, data: { items: [] } })),
}));

const side = (teamId, name) => ({ teamId, name, crestUrl: null, monogram: 'XX', score: 1 });
const fx = (id, h, a, status = 'ft') => ({
  id, compId: 'sco.1', kickoff: '2026-08-22T14:00:00Z', status, minute: null,
  home: side('h' + id, h), away: side('a' + id, a),
});

test('renders sections it has and the masthead date, skips empty sections', () => {
  render(
    <MemoryRouter>
      <TodayView
        date={new Date('2026-08-22T15:00:00Z')}
        followedIds={new Set()}
        partition={{ yours: [fx('1', 'Celtic', 'St Johnstone')], live: [],
          later: [], earlier: [], yesterday: [fx('2', 'Falkirk', 'Hearts')] }}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/Saturday 22 August/)).toBeInTheDocument();
  expect(screen.getByText('★ Your clubs')).toBeInTheDocument();
  expect(screen.getByText('Yesterday')).toBeInTheDocument();
  expect(screen.queryByText('Live')).toBeNull();
  expect(screen.queryByText('Later today')).toBeNull();
});

test('a completely quiet day says so', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-06-15T12:00:00Z')} followedIds={new Set()}
        partition={{ yours: [], live: [], later: [], earlier: [], yesterday: [] }} />
    </MemoryRouter>,
  );
  expect(screen.getByText('No matches today.')).toBeInTheDocument();
});

const nextUpFixture = {
  id: '3', compId: 'sco.1', kickoff: '2026-08-25T18:45:00Z', status: 'scheduled', tv: [],
  home: { teamId: '256', name: 'Celtic', score: null },
  away: { teamId: '250', name: 'Aberdeen', score: null },
};
const nextUpEntry = {
  club: { id: '256', name: 'Celtic', crestUrl: null, monogram: 'CE' },
  fixture: nextUpFixture,
};
const emptyPartition = { yours: [], live: [], later: [], earlier: [], yesterday: [] };

test('a nextUp-only day still renders the Your clubs section with its Next up sub-list', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set()}
        partition={emptyPartition} nextUp={[nextUpEntry]} />
    </MemoryRouter>,
  );
  expect(screen.getByText('★ Your clubs')).toBeInTheDocument();
  expect(screen.getByText('Next up')).toBeInTheDocument();
});

test('nextUp does not count as activity for the quiet-day check', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set()}
        partition={emptyPartition} nextUp={[nextUpEntry]} />
    </MemoryRouter>,
  );
  expect(screen.getByText('No matches today.')).toBeInTheDocument();
});

test('the Next up row carries a calendar button linking to the club calendar', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set()}
        partition={emptyPartition} nextUp={[nextUpEntry]} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: 'Celtic calendar' })).toBeInTheDocument();
});

test('clicking the Next up calendar button navigates to the club calendar', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  const routes = (await import('react-router-dom'));
  let where = null;
  function Probe() { where = routes.useLocation().pathname; return null; }
  render(
    <MemoryRouter initialEntries={['/']}>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set()}
        partition={emptyPartition} nextUp={[nextUpEntry]} />
      <routes.Routes>
        <routes.Route path="*" element={<Probe />} />
      </routes.Routes>
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: 'Celtic calendar' }));
  expect(where).toBe('/calendar/256');
});

test('the Next up row shows the competition shortName before the kickoff string (spec §13.12)', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set()}
        partition={emptyPartition} nextUp={[nextUpEntry]} />
    </MemoryRouter>,
  );
  // nextUpFixture.compId is sco.1, shortName 'Premiership'.
  expect(screen.getByText(/^Premiership · /)).toBeInTheDocument();
});

test('the Next up row omits the competition text for an unknown competition id, without crashing', () => {
  const unknownEntry = { club: nextUpEntry.club, fixture: { ...nextUpFixture, compId: 'unknown-comp' } };
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set()}
        partition={emptyPartition} nextUp={[unknownEntry]} />
    </MemoryRouter>,
  );
  expect(screen.queryByText(/unknown-comp/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Celtic calendar' })).toBeInTheDocument();
});

test('the Next up row displays opponent name and context line as separate elements', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set()}
        partition={emptyPartition} nextUp={[nextUpEntry]} />
    </MemoryRouter>,
  );
  // Opponent name should be on its own element (does not contain kickoff time)
  const opponentElement = screen.getByText(/^v Aberdeen/);
  expect(opponentElement.textContent).not.toMatch(/\d{1,2}:\d{2}/);
  // Context line should contain the kickoff time
  expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
});

// --- draw invitations (spec §8.2, §13.14) ---

const draw = (id, round) => ({
  comp: { id, name: id === 'sco.tennents' ? 'Scottish Cup' : 'FA Cup' },
  round, roundLabel: 'Fourth round', ties: [{ id: 't1' }, { id: 't2' }],
});

test('renders one draw invitation card per draw, above the Your clubs section', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set()}
        partition={{ yours: [fx('1', 'Celtic', 'St Johnstone')], live: [], later: [], earlier: [], yesterday: [] }}
        draws={[draw('sco.tennents', 'fourth-round'), draw('eng.fa', 'third-round')]} />
    </MemoryRouter>,
  );
  expect(screen.getAllByText('THE DRAW IS IN')).toHaveLength(2);
  const [firstCard] = screen.getAllByText('THE DRAW IS IN');
  const yourClubsHeading = screen.getByText('★ Your clubs');
  // eslint-disable-next-line no-bitwise
  expect(firstCard.compareDocumentPosition(yourClubsHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy();
});

test('a quiet day with an unrevealed draw still says "No matches today" (a card and the quiet line coexist)', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-06-15T12:00:00Z')} followedIds={new Set()}
        partition={emptyPartition} draws={[draw('sco.tennents', 'fourth-round')]} />
    </MemoryRouter>,
  );
  expect(screen.getByText('THE DRAW IS IN')).toBeInTheDocument();
  expect(screen.getByText('No matches today.')).toBeInTheDocument();
});

// --- club-centric phase-draw invitations (spec §13.15) ---

const phaseDraw = (compId, compName, teamId, clubName) => ({
  comp: { id: compId, name: compName },
  round: 'league-phase', roundLabel: 'League Phase',
  club: { teamId, name: clubName, crestUrl: null, monogram: clubName.slice(0, 2).toUpperCase() },
  fixtures: [{ id: 'f1' }, { id: 'f2' }],
});

test('renders phase-draw cards after tie-draw cards, above Your clubs', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set()}
        partition={{ yours: [fx('1', 'Celtic', 'St Johnstone')], live: [], later: [], earlier: [], yesterday: [] }}
        draws={[draw('sco.tennents', 'fourth-round')]}
        phaseDraws={[phaseDraw('uefa.champions', 'UEFA Champions League', '256', 'Celtic')]} />
    </MemoryRouter>,
  );
  const tieCard = screen.getByText('THE DRAW IS IN');
  const clubCard = screen.getByText("CELTIC'S DRAW IS IN");
  const yourClubsHeading = screen.getByText('★ Your clubs');
  // eslint-disable-next-line no-bitwise
  expect(tieCard.compareDocumentPosition(clubCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // eslint-disable-next-line no-bitwise
  expect(clubCard.compareDocumentPosition(yourClubsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('renders On TV section with televised fixture', () => {
  const onTvFixture = {
    id: 'f1',
    compId: 'eng.1',
    kickoff: '2026-08-21T19:00:00Z',
    status: 'scheduled',
    tv: ['Sky Sports'],
    home: side('1', 'Home'),
    away: side('2', 'Away'),
  };

  render(
    <MemoryRouter>
      <TodayView
        date={new Date('2026-08-21T00:00:00Z')}
        followedIds={new Set()}
        partition={emptyPartition}
        onTv={[onTvFixture]}
      />
    </MemoryRouter>,
  );

  expect(screen.getByText('On TV')).toBeInTheDocument();
  expect(screen.getByText('Sky')).toBeInTheDocument();
});

// --- quiet-day ordering (backlog, spec §13.18.4): the "No matches today."
// line must sit ABOVE On TV / Quick view, not below them. ---

test('on a quiet day, "No matches today." renders above On TV and Quick view', () => {
  const onTvFixture = {
    id: 'tv1', compId: 'eng.1', kickoff: '2026-08-21T19:00:00Z', status: 'scheduled',
    tv: ['Sky Sports'], home: side('1', 'Home'), away: side('2', 'Away'),
  };
  const tableRow = { teamId: 't1', name: 'Team One', crestUrl: null, monogram: 'T1', position: 1, points: 10 };

  render(
    <MemoryRouter>
      <TodayView
        date={new Date('2026-08-21T00:00:00Z')}
        followedIds={new Set()}
        partition={emptyPartition}
        onTv={[onTvFixture]}
        quickTables={[{ comp: byId('sco.1'), rows: [tableRow] }]}
      />
    </MemoryRouter>,
  );

  const quietLine = screen.getByText('No matches today.');
  const onTvHeading = screen.getByText('On TV');
  const quickViewHeading = screen.getByText('Quick view');
  // eslint-disable-next-line no-bitwise
  expect(quietLine.compareDocumentPosition(onTvHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // eslint-disable-next-line no-bitwise
  expect(quietLine.compareDocumentPosition(quickViewHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

// --- The papers placement (spec §13.19.2) ---

test('The papers section sits after Earlier today and before On TV', () => {
  const onTvFixture = {
    id: 'tv1', compId: 'eng.1', kickoff: '2026-08-21T19:00:00Z', status: 'scheduled',
    tv: ['Sky Sports'], home: side('1', 'Home'), away: side('2', 'Away'),
  };

  render(
    <MemoryRouter>
      <TodayView
        date={new Date('2026-08-21T00:00:00Z')}
        followedIds={new Set()}
        partition={{ yours: [], live: [], later: [], earlier: [fx('9', 'Falkirk', 'Hearts')], yesterday: [] }}
        onTv={[onTvFixture]}
      />
    </MemoryRouter>,
  );

  const earlierHeading = screen.getByText('Earlier today');
  const papersHeading = screen.getByText('The papers');
  const onTvHeading = screen.getByText('On TV');
  // eslint-disable-next-line no-bitwise
  expect(earlierHeading.compareDocumentPosition(papersHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // eslint-disable-next-line no-bitwise
  expect(papersHeading.compareDocumentPosition(onTvHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

// --- motion (spec §13.21): each top-level section rises in on mount, one
// static delay class per named slot regardless of which sections happen to
// be present ("no coordination needed beyond the static classes") — capped
// at rise-in-5, which past the fifth named section (On TV, Quick view)
// holds rather than going un-staggered or inventing a rise-in-6/7 that
// doesn't exist. ---

// Every section label below is an <h2> (SectionLabel) — queried by heading
// role rather than text, since "Live" also appears as StatusWord's own
// live-indicator text inside a fixture row in the same render.
function riseSection(label) {
  return screen.getByRole('heading', { name: label }).closest('[class*="rise-in"]');
}

test('sections carry .rise-in with staggered delay classes in DOM order, capped at rise-in-5', () => {
  const onTvFixture = {
    id: 'tv1', compId: 'eng.1', kickoff: '2026-08-21T19:00:00Z', status: 'scheduled',
    tv: ['Sky Sports'], home: side('1', 'Home'), away: side('2', 'Away'),
  };
  const tableRow = { teamId: 't1', name: 'Team One', crestUrl: null, monogram: 'T1', position: 1, points: 10 };

  render(
    <MemoryRouter>
      <TodayView
        date={new Date('2026-08-22T15:00:00Z')}
        followedIds={new Set()}
        partition={{
          yours: [fx('1', 'Celtic', 'St Johnstone')],
          live: [fx('2', 'Hibernian', 'Hearts', 'live')],
          later: [fx('3', 'Motherwell', 'Livingston')],
          earlier: [fx('4', 'Falkirk', 'Ayr United')],
          yesterday: [],
        }}
        onTv={[onTvFixture]}
        quickTables={[{ comp: byId('sco.1'), rows: [tableRow] }]}
      />
    </MemoryRouter>,
  );

  const yourClubs = riseSection('★ Your clubs');
  const live = riseSection('Live');
  const later = riseSection('Later today');
  const earlier = riseSection('Earlier today');
  const papers = riseSection('The papers');
  const onTv = riseSection('On TV');
  const quickView = riseSection('Quick view');

  expect(yourClubs).toHaveClass('rise-in', 'rise-in-1');
  expect(live).toHaveClass('rise-in', 'rise-in-2');
  expect(later).toHaveClass('rise-in', 'rise-in-3');
  expect(earlier).toHaveClass('rise-in', 'rise-in-4');
  expect(papers).toHaveClass('rise-in', 'rise-in-5');
  expect(onTv).toHaveClass('rise-in', 'rise-in-5');
  expect(quickView).toHaveClass('rise-in', 'rise-in-5');

  // eslint-disable-next-line no-bitwise
  expect(yourClubs.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // eslint-disable-next-line no-bitwise
  expect(live.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // eslint-disable-next-line no-bitwise
  expect(later.compareDocumentPosition(earlier) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // eslint-disable-next-line no-bitwise
  expect(earlier.compareDocumentPosition(papers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // eslint-disable-next-line no-bitwise
  expect(papers.compareDocumentPosition(onTv) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // eslint-disable-next-line no-bitwise
  expect(onTv.compareDocumentPosition(quickView) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('"Yesterday" carries no rise-in class — it is not one of the named arrival sections', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set()}
        partition={{ yours: [], live: [], later: [], earlier: [], yesterday: [fx('2', 'Falkirk', 'Hearts')] }} />
    </MemoryRouter>,
  );
  const yesterday = screen.getByText('Yesterday').closest('section');
  expect(yesterday.className).not.toMatch(/rise-in/);
});
