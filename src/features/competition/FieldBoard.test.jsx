import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FieldBoard from './FieldBoard.jsx';
import { byId } from '../../domain/competitions.js';

const side = (teamId, name, score = null, penaltyScore = null) =>
  ({ teamId, name, crestUrl: `${teamId}.png`, monogram: name.slice(0, 2).toUpperCase(), score, penaltyScore });

const fx = (id, round, kickoff, status, home, away) =>
  ({ id, compId: 'sco.tennents', kickoff, status, minute: null, round, venue: null, home, away });

const scoCup = byId('sco.tennents'); // country: Scotland -> singleLeg true
const uclComp = byId('uefa.champions'); // country: Europe -> singleLeg false

function renderBoard(props) {
  return render(
    <MemoryRouter>
      <FieldBoard {...props} />
    </MemoryRouter>,
  );
}

test('empty fixtures render the honest pre-draw line', () => {
  renderBoard({ fixtures: [], comp: uclComp, followedIds: new Set() });
  expect(screen.getByText("The draw hasn't been made yet.")).toBeInTheDocument();
});

test('two-tier entrants render sub-labels, counts, and a 4-col grid per tier', () => {
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'scheduled', side('1', 'Alpha'), side('2', 'Bravo')),
    fx('2', 'round-2', '2026-02-01T15:00:00Z', 'scheduled', side('3', 'Charlie'), side('4', 'Delta')),
  ];
  renderBoard({ fixtures, comp: scoCup, followedIds: new Set() });
  const stillIn = screen.getByRole('heading', { name: 'Still in' });
  expect(within(stillIn.parentElement).getByText('4')).toBeInTheDocument();
  expect(screen.getByText('Round 1 entrants · 2')).toBeInTheDocument();
  expect(screen.getByText('Round 2 entrants · 2')).toBeInTheDocument();
  expect(screen.getByText('Alpha')).toBeInTheDocument();
  expect(screen.getByText('Bravo')).toBeInTheDocument();
  expect(screen.getByText('Charlie')).toBeInTheDocument();
  expect(screen.getByText('Delta')).toBeInTheDocument();
});

test('single-tier entrants render one grid with no sub-labels', () => {
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'scheduled', side('1', 'Alpha'), side('2', 'Bravo')),
  ];
  renderBoard({ fixtures, comp: scoCup, followedIds: new Set() });
  const stillIn = screen.getByRole('heading', { name: 'Still in' });
  expect(within(stillIn.parentElement).getByText('2')).toBeInTheDocument();
  expect(screen.queryByText(/entrants ·/)).toBeNull();
});

test('out clubs group by round fallen, most recent round first, with grayscale crests and no names', () => {
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 2), side('2', 'Bravo', 0)),
    fx('2', 'round-2', '2026-02-01T15:00:00Z', 'ft', side('1', 'Alpha', 3), side('3', 'Charlie', 0)),
    fx('3', 'round-3', '2026-03-01T15:00:00Z', 'scheduled', side('1', 'Alpha'), side('4', 'Delta')),
  ];
  renderBoard({ fixtures, comp: scoCup, followedIds: new Set() });
  const out = screen.getByRole('heading', { name: 'Out' });
  expect(within(out.parentElement).getByText('2')).toBeInTheDocument();
  const labels = screen.getAllByText(/^Fell in the/).map(el => el.textContent);
  // round-2 (most recent fallen round) before round-1
  expect(labels).toEqual(['Fell in the Round 2', 'Fell in the Round 1']);
  // Grayscale crest links carry the club name as an aria-label, no visible name text.
  const charlieLink = screen.getByLabelText('Charlie');
  expect(charlieLink).toHaveClass('grayscale');
  expect(screen.queryByText('Charlie', { selector: 'span' })).toBeNull();
});

test('champion renders a centered winners flourish, excluded from Still in', () => {
  const fixtures = [
    fx('1', 'semifinals', '2026-01-01T15:00:00Z', 'ft', side('5', 'Echo', 0), side('1', 'Alpha', 3)),
    fx('2', 'semifinals', '2026-01-01T15:00:00Z', 'ft', side('6', 'Foxtrot', 1), side('2', 'Bravo', 2)),
    fx('3', 'final', '2026-02-01T15:00:00Z', 'ft', side('1', 'Alpha', 2), side('2', 'Bravo', 0)),
  ];
  renderBoard({ fixtures, comp: scoCup, followedIds: new Set() });
  expect(screen.getByText('WINNERS')).toBeInTheDocument();
  // Alpha's name appears in the winners flourish; not also duplicated in a Still-in grid.
  expect(screen.getAllByText('Alpha')).toHaveLength(1);
  expect(screen.queryByText('Still in')).toBeNull();
});

test('crest links carry the correct team-page hrefs', () => {
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'scheduled', side('1', 'Alpha'), side('2', 'Bravo')),
  ];
  renderBoard({ fixtures, comp: scoCup, followedIds: new Set() });
  const alphaLink = screen.getByText('Alpha').closest('a');
  expect(alphaLink).toHaveAttribute('href', '/team/sco.tennents/1');
});

test('followed clubs carry a star after their name', () => {
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'scheduled', side('1', 'Alpha'), side('2', 'Bravo')),
  ];
  renderBoard({ fixtures, comp: scoCup, followedIds: new Set(['1']) });
  const alphaLink = screen.getByText('Alpha').closest('a');
  expect(within(alphaLink).getByText('★')).toBeInTheDocument();
});

test('an in-club whose earliest fixture has no round still renders (in an untiered grid), count matches drawn crests', () => {
  const fixtures = [
    // Zulu/Yankee's only fixture carries no round — entryTiers skips them
    // entirely (field.js: a null-round fixture is invisible to tiering) —
    // but they're still `in` (round-null fixtures are also invisible to
    // survivalState's elimination rules), so they must still be drawn.
    fx('0', null, '2026-01-01T15:00:00Z', 'scheduled', side('9', 'Zulu'), side('10', 'Yankee')),
    fx('1', 'round-1', '2026-01-02T15:00:00Z', 'scheduled', side('1', 'Alpha'), side('2', 'Bravo')),
    fx('2', 'round-2', '2026-02-01T15:00:00Z', 'scheduled', side('3', 'Charlie'), side('4', 'Delta')),
  ];
  renderBoard({ fixtures, comp: scoCup, followedIds: new Set() });
  const stillIn = screen.getByRole('heading', { name: 'Still in' });
  expect(within(stillIn.parentElement).getByText('6')).toBeInTheDocument();
  expect(screen.getByText('Also in · 2')).toBeInTheDocument();
  expect(screen.getByText('Zulu')).toBeInTheDocument();
  expect(screen.getByText('Yankee')).toBeInTheDocument();
  // Six crests drawn total: two per tier plus the two untiered clubs — the
  // count must match the "Still in" numeral, never silently dropping a survivor.
  expect(screen.getAllByRole('img')).toHaveLength(6);
});
