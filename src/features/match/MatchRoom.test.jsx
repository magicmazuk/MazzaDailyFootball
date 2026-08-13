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

test('BBC competitions get the honest degraded line, not empty shelves', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, compId: 'scottish-league-one' }}
      comp={byId('scottish-league-one')} detail={null} />
  </MemoryRouter>);
  expect(screen.getByText("Detailed stats aren't published for Scottish League One."))
    .toBeInTheDocument();
});
