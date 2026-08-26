import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

vi.mock('../data/queries.js', () => ({ useFplIndex: vi.fn() }));
import { useFplIndex } from '../data/queries.js';
import FantasyLadder from './FantasyLadder.jsx';

const INDEX = {
  teams: [{ id: 1, name: 'Arsenal' }, { id: 2, name: 'Newcastle' }],
  players: [
    { code: 1, web: 'Saka', team: 1, points: 9, event: 4 },
    { code: 3, web: 'Ødegaard', team: 1, points: 11, event: 5 },
    { code: 4, web: 'Elanga', team: 2, points: 12, event: 7 },
  ],
};

test('the club ladder ranks the squad with the quick-table recipes', () => {
  useFplIndex.mockReturnValue({ data: INDEX });
  render(<FantasyLadder club="Arsenal" />);
  expect(screen.getByText('The fantasy ladder')).toBeInTheDocument();
  const names = screen.getAllByText(/Saka|Ødegaard/).map(el => el.textContent);
  expect(names).toEqual(['Ødegaard', 'Saka']);
  const rank = screen.getByText('1');
  expect(rank.className).toBe('w-4 font-sans text-[10px] text-muted tabular-nums shrink-0');
  expect(screen.getByText('11').className).toBe('text-[13px] tabular-nums shrink-0');
  // the gameweek figure rides muted beside the season total
  expect(screen.getByText('+5').className).toBe('font-sans text-[10px] text-muted tabular-nums shrink-0');
  // the source credited, the house way
  expect(screen.getByText('Source · Fantasy Premier League')).toBeInTheDocument();
});

test('the league ladder wears each club beside the name', () => {
  useFplIndex.mockReturnValue({ data: INDEX });
  render(<FantasyLadder league />);
  const top = screen.getByText('Elanga');
  expect(top.parentElement.textContent).toContain('Newcastle');
});

test('no index, or the pre-points cache, renders nothing at all', () => {
  useFplIndex.mockReturnValue({ data: undefined });
  const { container, rerender } = render(<FantasyLadder club="Arsenal" />);
  expect(container.innerHTML).toBe('');
  useFplIndex.mockReturnValue({ data: { teams: INDEX.teams, players: [{ code: 1, web: 'Saka', team: 1 }] } });
  rerender(<FantasyLadder club="Arsenal" />);
  expect(container.innerHTML).toBe('');
});
