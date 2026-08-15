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
