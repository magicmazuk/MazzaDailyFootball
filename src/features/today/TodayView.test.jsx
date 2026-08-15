import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TodayView from './TodayView.jsx';

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
