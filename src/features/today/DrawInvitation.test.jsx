import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import DrawInvitation from './DrawInvitation.jsx';

const draw = {
  comp: { id: 'sco.tennents', name: 'Scottish Cup', shortName: 'Scottish Cup' },
  round: 'fourth-round',
  roundLabel: 'Fourth round',
  ties: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
};

test('renders the accent label, comp name, round label and unrevealed count', () => {
  render(<MemoryRouter><DrawInvitation draw={draw} /></MemoryRouter>);
  expect(screen.getByText('THE DRAW IS IN')).toBeInTheDocument();
  expect(screen.getByText(/Scottish Cup/)).toBeInTheDocument();
  expect(screen.getByText(/Fourth round/)).toBeInTheDocument();
  expect(screen.getByText('3 ties unrevealed')).toBeInTheDocument();
  expect(screen.getByText('Reveal them →')).toBeInTheDocument();
});

test('the whole card is a single link to the draw ceremony route', () => {
  render(<MemoryRouter><DrawInvitation draw={draw} /></MemoryRouter>);
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link')).toHaveAttribute('href', '/draw/sco.tennents/fourth-round');
});

test('the decorative dots are hidden from assistive tech', () => {
  render(<MemoryRouter><DrawInvitation draw={draw} /></MemoryRouter>);
  expect(screen.getByText('● ● ● ●')).toHaveAttribute('aria-hidden', 'true');
});

// --- club variant (spec §13.15) ---

const clubDraw = {
  comp: { id: 'uefa.champions', name: 'UEFA Champions League', shortName: 'Champions League' },
  round: 'league-phase',
  roundLabel: 'League Phase',
  club: { teamId: '256', name: 'Celtic', crestUrl: null, monogram: 'CE' },
  fixtures: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }],
};

test('the club variant renders the club label, comp/round line, opponent count and a crest', () => {
  render(<MemoryRouter><DrawInvitation draw={clubDraw} /></MemoryRouter>);
  expect(screen.getByText("CELTIC'S DRAW IS IN")).toBeInTheDocument();
  expect(screen.getByText(/UEFA Champions League/)).toBeInTheDocument();
  expect(screen.getByText(/League Phase/)).toBeInTheDocument();
  expect(screen.getByText('3 opponents')).toBeInTheDocument();
  expect(screen.getByLabelText('Celtic')).toBeInTheDocument(); // Crest's monogram fallback
});

test('the club variant links to the club-centric opponents route, not the round-wide one', () => {
  render(<MemoryRouter><DrawInvitation draw={clubDraw} /></MemoryRouter>);
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link')).toHaveAttribute('href', '/draw/uefa.champions/league-phase/256');
});

test('the tie-draw variant is unaffected — no club key means the original card renders', () => {
  render(<MemoryRouter><DrawInvitation draw={draw} /></MemoryRouter>);
  expect(screen.getByText('THE DRAW IS IN')).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href', '/draw/sco.tennents/fourth-round');
});
