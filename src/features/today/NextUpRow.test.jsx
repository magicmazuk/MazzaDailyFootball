import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import NextUpRow from './NextUpRow.jsx';

const club = { id: '256', name: 'Celtic', crestUrl: null, monogram: 'CE' };
const fixture = (over = {}) => ({
  id: 'e9', compId: 'uefa.champions', kickoff: '2026-08-26T19:00:00Z', status: 'scheduled',
  round: 'playoff-round', tv: null,
  home: { teamId: '256', name: 'Celtic' }, away: { teamId: '4411', name: 'LASK Linz' },
  ...over,
});

// Spec §13.29 follow-up: the leg reads on Next up too — the row that tells
// you what's coming must say it's half of something.
test('a leg fixture names its leg in the next-up context line', () => {
  render(<MemoryRouter>
    <NextUpRow club={club} fixture={fixture({ leg: 2 })} />
  </MemoryRouter>);
  expect(screen.getByText(/Champions League · 2nd leg ·/)).toBeInTheDocument();
});

test('an ordinary fixture keeps the context line leg-free', () => {
  render(<MemoryRouter>
    <NextUpRow club={club} fixture={fixture({ compId: 'sco.1', leg: null })} />
  </MemoryRouter>);
  expect(screen.queryByText(/leg/)).not.toBeInTheDocument();
});
