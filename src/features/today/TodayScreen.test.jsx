import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { COMPETITIONS } from '../../domain/competitions.js';
import { usePrefs } from '../../store/prefs.js';

vi.mock('../../data/queries.js', () => ({
  // Mirrors useQueries({ queries: [] }) === [] when there is nothing to fetch.
  useTodayWindows: comps => comps.map(() => ({ isLoading: true, data: undefined })),
  useAllSeasonFixtures: comps => comps.map(() => ({ isLoading: true, data: undefined })),
  useTable: () => ({ isLoading: true, data: undefined }),
}));

import TodayScreen from './TodayScreen.jsx';

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({ followed: {}, hiddenComps: COMPETITIONS.map(c => c.id) });
});

test('hiding every competition shows the normal empty day, not a permanent loading state', () => {
  render(<MemoryRouter><TodayScreen /></MemoryRouter>);
  expect(screen.getByText('No matches today.')).toBeInTheDocument();
  expect(screen.queryByText("Fetching today's football…")).not.toBeInTheDocument();
});
