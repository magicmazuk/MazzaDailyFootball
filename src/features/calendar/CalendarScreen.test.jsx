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
