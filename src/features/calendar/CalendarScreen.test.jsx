import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { usePrefs, CELTIC } from '../../store/prefs.js';

const fx = (id, h, hn, a, an, compId = 'sco.1') => ({
  id, compId, kickoff: '2026-08-22T14:00:00Z', status: 'scheduled',
  home: { teamId: h, name: hn, crestUrl: null, monogram: hn.slice(0, 2).toUpperCase(), score: null },
  away: { teamId: a, name: an, crestUrl: null, monogram: an.slice(0, 2).toUpperCase(), score: null },
});

let seasonFixtures = [];
vi.mock('../../data/queries.js', () => ({
  useAllSeasonFixtures: () => [{ isLoading: false, data: { fixtures: seasonFixtures } }],
}));

import CalendarScreen from './CalendarScreen.jsx';

const renderAt = teamId => render(
  <MemoryRouter initialEntries={[`/calendar/${teamId}`]}>
    <Routes>
      <Route path="/calendar/:teamId" element={<CalendarScreen />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  localStorage.clear();
});

test('club calendar header (crest + name) is a link to the team page, using the followed club\'s compId', () => {
  usePrefs.setState({ followed: { [CELTIC.id]: CELTIC }, hiddenComps: [] });
  seasonFixtures = [fx('1', CELTIC.id, 'Celtic', '267', 'St Johnstone')];
  renderAt(CELTIC.id);
  const link = screen.getByRole('link', { name: /Celtic/ });
  expect(link).toHaveAttribute('href', `/team/${CELTIC.compId}/${CELTIC.id}`);
});

test('club calendar header falls back to the fixture\'s compId when the club is not followed', () => {
  usePrefs.setState({ followed: {}, hiddenComps: [] });
  seasonFixtures = [fx('2', '254', 'Falkirk', '250', 'St Mirren', 'sco.1')];
  renderAt('254');
  const link = screen.getByRole('link', { name: /Falkirk/ });
  expect(link).toHaveAttribute('href', '/team/sco.1/254');
});

// --- month paging clears the selected day (backlog, spec §13.18.4) ---

test('paging to another month clears the selected day — no day stays highlighted from the previous month', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  usePrefs.setState({ followed: {}, hiddenComps: [] });
  seasonFixtures = [];
  renderAt('254');

  // Today starts selected — exactly one day cell is pressed.
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);

  await user.click(screen.getByRole('button', { name: 'Next month' }));

  expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
});

// --- motion (spec §13.21): the page's top-level blocks — header (club link
// or the plain "Fixtures" title), the month nav + grid, the selected-day
// fixture list — rise in on mount, one static delay class per slot. ---

test('the calendar page\'s top-level blocks carry staggered .rise-in classes', () => {
  usePrefs.setState({ followed: { [CELTIC.id]: CELTIC }, hiddenComps: [] });
  seasonFixtures = [fx('1', CELTIC.id, 'Celtic', '267', 'St Johnstone')];
  const { container } = renderAt(CELTIC.id);

  const header = screen.getByRole('link', { name: /Celtic/ }).closest('.rise-in');
  const monthArea = screen.getByRole('heading', { level: 2 }).closest('.rise-in');
  const dayList = container.querySelector('section').closest('.rise-in');

  expect(header).toHaveClass('rise-in-1');
  expect(monthArea).toHaveClass('rise-in-2');
  expect(dayList).toHaveClass('rise-in-3');
});
