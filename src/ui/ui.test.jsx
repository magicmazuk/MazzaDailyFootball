import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Crest from './Crest.jsx';
import StatusWord from './StatusWord.jsx';
import FixtureRow from './FixtureRow.jsx';

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

test('FixtureRow links to the match and stars a followed side', () => {
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft', {
        home: side({ teamId: '256', name: 'Celtic', crestUrl: 'c.png', score: 2 }),
        away: side({ teamId: '267', name: 'St Johnstone', score: 0 }),
      })} followedIds={new Set(['256'])} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link')).toHaveAttribute('href', '/match/sco.1/e1');
  expect(screen.getByText('★')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
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
  expect(screen.getAllByRole('button')).toHaveLength(2); // just the two crest buttons
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
