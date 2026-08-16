import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

vi.mock('../../data/queries.js', () => ({ usePlayer: vi.fn() }));

import PlayerScreen from './PlayerScreen.jsx';
import { usePlayer } from '../../data/queries.js';

const outfieldBio = {
  id: '272624', name: 'Kasper Høgh', position: 'Forward', shirt: '9', age: 25,
  nationality: 'Denmark', heightDisplay: "6' 1\"", birthDate: '2000-12-06T08:00Z', birthPlace: null,
};

const outfieldStats = {
  appearances: 2, starts: 2, minutes: 172, goals: 3, assists: 0,
  shotsOnTarget: 5, shotsOffTarget: 4, totalShots: 13,
  accuratePasses: 23, inaccuratePasses: 15, totalPasses: 38, passPct: 0.605,
  foulsCommitted: 3, yellowCards: 0, redCards: 0, effectiveTackles: 1,
  saves: null, cleanSheets: null, goalsConceded: null, rating: null,
};

const keeperBio = { ...outfieldBio, id: '999', name: 'Kasper Schmeichel', position: 'Goalkeeper', shirt: '1' };

const keeperStats = {
  appearances: 5, starts: 5, minutes: 450, goals: null, assists: null,
  shotsOnTarget: null, shotsOffTarget: null, totalShots: null,
  accuratePasses: null, inaccuratePasses: null, totalPasses: null, passPct: null,
  foulsCommitted: 1, yellowCards: 0, redCards: 0, effectiveTackles: 0,
  saves: 14, cleanSheets: 3, goalsConceded: 4, rating: 6.8,
};

function renderAt(compId, playerId, state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/player/${compId}/${playerId}`, state }]}>
      <Routes>
        <Route path="player/:compId/:playerId" element={<PlayerScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

test('an outfield player renders the attacking splits with real numbers and no keeper section', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  renderAt('sco.1', '272624');

  expect(screen.getByText('Kasper Høgh')).toBeInTheDocument();
  expect(screen.getByText('№ 9')).toBeInTheDocument();
  expect(screen.getByText('Attacking')).toBeInTheDocument();
  expect(screen.getByText('13 shots — 5 on target')).toBeInTheDocument();
  expect(screen.getByText('38 attempted — 60.5%')).toBeInTheDocument();
  expect(screen.queryByText('Keeper')).not.toBeInTheDocument();
  expect(screen.queryByText('Saves')).not.toBeInTheDocument();
});

test('a keeper renders the keeper view and no attacking section', () => {
  usePlayer.mockReturnValue({ bio: keeperBio, stats: keeperStats, isLoading: false, isError: false });
  renderAt('sco.1', '999');

  expect(screen.getByText('Kasper Schmeichel')).toBeInTheDocument();
  expect(screen.queryByText('Attacking')).not.toBeInTheDocument();
  expect(screen.getByText('14')).toBeInTheDocument(); // saves
  expect(screen.getByText('Saves')).toBeInTheDocument();
  expect(screen.getByText('Clean sheets')).toBeInTheDocument();
  expect(screen.getByText('Conceded')).toBeInTheDocument();
});

test('a null rating renders no rating gauge', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  renderAt('sco.1', '272624');
  expect(screen.queryByText('Rating')).not.toBeInTheDocument();
});

test('a non-null rating renders the rating gauge', () => {
  usePlayer.mockReturnValue({ bio: keeperBio, stats: keeperStats, isLoading: false, isError: false });
  renderAt('sco.1', '999');
  expect(screen.getByText('Rating')).toBeInTheDocument();
  expect(screen.getByText('6.8')).toBeInTheDocument();
});

test('the minutes gauge shows minutes of appearances*90', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  renderAt('sco.1', '272624');
  expect(screen.getByText('Minutes played — 172′ of 180′')).toBeInTheDocument();
});

test('discipline renders three plain numbers, red cards flagged in accent', () => {
  const withRed = { ...outfieldStats, yellowCards: 1, redCards: 1 };
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: withRed, isLoading: false, isError: false });
  renderAt('sco.1', '272624');
  expect(screen.getByText('Discipline & defence')).toBeInTheDocument();
  const cardsValue = screen.getByText('2'); // 1 yellow + 1 red
  expect(cardsValue.className).toMatch(/accent/);
});

test('nothing renders with a portrait/roundel/mark visual anywhere', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = renderAt('sco.1', '272624');
  expect(container.querySelectorAll('[class*="mark"], [class*="roundel"], [class*="portrait"], [class*="avatar"]'))
    .toHaveLength(0);
});

test('the kicker uses the competition name and position, not the club', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  renderAt('sco.1', '272624');
  expect(screen.getByText('Scottish Premiership · Forward')).toBeInTheDocument();
});

test('the bio line prepends the club when passed via router state', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  renderAt('sco.1', '272624', { club: 'Celtic' });
  expect(screen.getByText(/^Celtic · Denmark · 25 · 6' 1" · 2 games$/)).toBeInTheDocument();
});

test('the bio line has no club prefix when router state carries none', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  renderAt('sco.1', '272624');
  expect(screen.getByText(/^Denmark · 25 · 6' 1" · 2 games$/)).toBeInTheDocument();
});

test('a loading player shows a muted one-liner', () => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: true, isError: false });
  renderAt('sco.1', '272624');
  expect(screen.getByText('Loading player…')).toBeInTheDocument();
});

test('an errored/missing player shows a muted one-liner', () => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: true });
  renderAt('sco.1', '272624');
  expect(screen.getByText('Player unavailable right now.')).toBeInTheDocument();
});

test('an unknown competition id shows the honest message', () => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: false });
  renderAt('does-not-exist', '272624');
  expect(screen.getByText('Unknown competition.')).toBeInTheDocument();
});

// --- home-league hotfix (Aug 2026): a stats-only failure must not blank
// the page, and the unavailable line is gated on bio alone, not isError ---

test('a statistics-only failure (stats null, bio present, isError false) still renders the bio and no stat sections', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: null, isLoading: false, isError: false });
  renderAt('uefa.champions', '272624');

  expect(screen.getByText('Kasper Høgh')).toBeInTheDocument();
  expect(screen.queryByText('Attacking')).not.toBeInTheDocument();
  expect(screen.queryByText('Keeper')).not.toBeInTheDocument();
  expect(screen.queryByText('Discipline & defence')).not.toBeInTheDocument();
  expect(screen.queryByText('Rating')).not.toBeInTheDocument();
});

test('a null bio shows the unavailable line even when isError is false — gated on bio alone', () => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: false });
  renderAt('sco.1', '272624');
  expect(screen.getByText('Player unavailable right now.')).toBeInTheDocument();
});
