import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { usePrefs, CELTIC } from '../../store/prefs.js';

vi.mock('../../data/queries.js', () => ({
  useAllTeams: () => [{ data: { teams: [
    { id: '256', name: 'Celtic', shortName: 'Celtic', crestUrl: null,
      monogram: 'CE', colour: null },
    { id: '254', name: 'Falkirk', shortName: 'Falkirk', crestUrl: null,
      monogram: 'FA', colour: null },
  ] } }],
  useAllSeasonFixtures: () => [],
}));

import ClubsScreen from './ClubsScreen.jsx';

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({ followed: { [CELTIC.id]: CELTIC }, hiddenComps: [] });
});

test('Celtic is listed as fixed; searching finds and follows Falkirk', async () => {
  render(<MemoryRouter><ClubsScreen /></MemoryRouter>);
  expect(screen.getByText('Celtic')).toBeInTheDocument();
  expect(screen.getByText('Your club')).toBeInTheDocument();

  await userEvent.type(screen.getByPlaceholderText('Search for a club…'), 'falk');
  await userEvent.click(await screen.findByRole('button', { name: /Follow Falkirk/ }));
  expect(usePrefs.getState().followed['254'].name).toBe('Falkirk');
});

test('competition visibility toggles write to the store', async () => {
  render(<MemoryRouter><ClubsScreen /></MemoryRouter>);
  await userEvent.click(screen.getByRole('checkbox', { name: /FA Cup/ }));
  expect(usePrefs.getState().hiddenComps).toContain('eng.fa');
});

test('Celtic in search results shows Your club label, never unfollow button', async () => {
  render(<MemoryRouter><ClubsScreen /></MemoryRouter>);
  await userEvent.type(screen.getByPlaceholderText('Search for a club…'), 'celt');
  expect(screen.queryByRole('button', { name: /Unfollow Celtic/ })).not.toBeInTheDocument();
  const yourClubLabels = screen.getAllByText('Your club');
  expect(yourClubLabels).toHaveLength(2); // One in Following section, one in search results
});
