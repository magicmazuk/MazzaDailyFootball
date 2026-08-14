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

test('followed clubs get calendar chips linking to their club calendar', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-08-22T15:00:00Z')} followedIds={new Set(['256'])}
        partition={{ yours: [], live: [], later: [], earlier: [], yesterday: [] }}
        nextUp={[]} quickTables={[]}
        followedClubs={[{ id: '256', name: 'Celtic', crestUrl: null, monogram: 'CE' }]} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Celtic calendar' }))
    .toHaveAttribute('href', '/calendar/256');
  expect(screen.getByText('No matches today.')).toBeInTheDocument(); // chips ≠ activity
});
