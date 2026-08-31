import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

vi.mock('../../data/queries.js', () => ({
  useTodayWindows: vi.fn(() => []),
  useTable: vi.fn(() => ({ data: undefined })),
  useUpcomingBroadcasts: vi.fn(() => []),
}));
import { useTable, useTodayWindows } from '../../data/queries.js';
import { COMPETITIONS } from '../../domain/competitions.js';
import DeskScreen from './DeskScreen.jsx';

const at = new Date(); at.setHours(15, 0, 0, 0);
const liveFx = {
  id: 'd1', status: 'live', minute: "67'", kickoff: at.toISOString(),
  home: { teamId: 'h', name: 'Celtic', score: 2 },
  away: { teamId: 'a', name: 'Falkirk', score: 1 },
  goals: [
    { minute: "4'", clockValue: 240, scorer: 'Camilo Durán', teamId: 'h', ownGoal: false, penalty: false },
    { minute: "51'", clockValue: 3060, scorer: 'A Ross', teamId: 'a', ownGoal: false, penalty: false },
  ],
};

test('the back page: live card with scorer line, the wire, and the quiet degrades', () => {
  useTodayWindows.mockImplementation(comps => comps.map((comp, i) => (
    comp.id === 'sco.1' ? { data: { fixtures: [liveFx] } } : { data: { fixtures: [] } }
  )));
  useTable.mockReturnValue({ data: { rows: [
    { teamId: 't1', name: 'Celtic', position: 1, points: 9 },
  ] } });
  render(<MemoryRouter><DeskScreen /></MemoryRouter>);
  expect(screen.getByText('The Sports Desk')).toBeInTheDocument();
  const card = screen.getByTestId('desk-live');
  expect(card.textContent).toContain('Celtic');
  expect(card.textContent).toContain('Durán 4′ — Ross 51′');
  // the wire rides beside it
  expect(screen.getAllByTestId('wire-row').length).toBeGreaterThan(0);
  expect(screen.getByText('Nothing settled yet.')).toBeInTheDocument();
});

test('a quiet day says so in the house one-liners, never blanks', () => {
  useTodayWindows.mockImplementation(comps => comps.map(() => ({ data: { fixtures: [] } })));
  useTable.mockReturnValue({ data: undefined });
  render(<MemoryRouter><DeskScreen /></MemoryRouter>);
  expect(screen.getByText('Nothing in play.')).toBeInTheDocument();
  expect(screen.getByText('Nothing settled yet.')).toBeInTheDocument();
});
