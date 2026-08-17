import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

vi.mock('../../data/queries.js', () => ({ usePlayer: vi.fn() }));

import PlayerScreen, { Splits } from './PlayerScreen.jsx';
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

// --- pass-share clamp (backlog #86): passPct is a 0-1 fraction; clamp it
// before computing the bar width so an out-of-range feed value can never
// overshoot the bar past 100% or push the remainder negative. ---

test('an out-of-range passPct (> 1) clamps the bar to 100%, not beyond', () => {
  const overStats = { ...outfieldStats, passPct: 1.5 };
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: overStats, isLoading: false, isError: false });
  renderAt('sco.1', '272624');
  expect(screen.getByText('38 attempted — 100.0%')).toBeInTheDocument();
});

test('a negative passPct clamps the bar to 0%, not below', () => {
  const underStats = { ...outfieldStats, passPct: -0.2 };
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: underStats, isLoading: false, isError: false });
  renderAt('sco.1', '272624');
  expect(screen.getByText('38 attempted — 0.0%')).toBeInTheDocument();
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

// --- the scout (spec §13.20.2, review fix): a compId with no registry
// entry no longer dead-ends the page on "Unknown competition." — byId
// falling through now builds a minimal synthetic { id, source: 'espn',
// name: null } descriptor instead, since usePlayer only ever reads id and
// source off comp. This is what makes "Open as page →" work from a
// foreign squad shirt's sheet (the discovered league, e.g. aut.1, has no
// registry entry either). ---

test('a compId with no registry entry falls back to a synthetic comp descriptor — never "Unknown competition."', () => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: false });
  renderAt('does-not-exist', '272624');
  expect(screen.queryByText('Unknown competition.')).not.toBeInTheDocument();
  // bio never resolved (as if the synthetic id 404'd upstream) — still an
  // honest message, never a crash or a blank page.
  expect(screen.getByText('Player unavailable right now.')).toBeInTheDocument();
});

test('a foreign discovered league (aut.1, no registry entry) renders the player via the synthetic comp descriptor', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  renderAt('aut.1', '272624');

  expect(screen.queryByText('Unknown competition.')).not.toBeInTheDocument();
  expect(screen.getByText('Kasper Høgh')).toBeInTheDocument();
  expect(usePlayer).toHaveBeenCalledWith({ id: 'aut.1', source: 'espn', name: null }, '272624');
  // comp.name is null on the synthetic descriptor — the header line omits
  // it rather than rendering the literal string "null"; bio.position alone.
  expect(screen.getByText('Forward')).toBeInTheDocument();
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

// --- extracted Splits (spec §13.18.3): PlayerSheet reuses this exact body
// when it expands, so it has to work standalone, given bio/stats/comp
// directly rather than via usePlayer + route params. ---

test('the exported Splits component renders the same attacking section standalone, outside PlayerScreen', () => {
  render(<Splits bio={outfieldBio} stats={outfieldStats} comp={{ id: 'sco.1', name: 'Scottish Premiership' }} />);
  expect(screen.getByText('Attacking')).toBeInTheDocument();
  expect(screen.getByText('13 shots — 5 on target')).toBeInTheDocument();
  expect(screen.getByText('38 attempted — 60.5%')).toBeInTheDocument();
});

test('the exported Splits component renders the keeper section standalone', () => {
  render(<Splits bio={keeperBio} stats={keeperStats} comp={{ id: 'sco.1', name: 'Scottish Premiership' }} />);
  expect(screen.getByText('Saves')).toBeInTheDocument();
  expect(screen.getByText('Rating')).toBeInTheDocument();
  expect(screen.getByText('6.8')).toBeInTheDocument();
});

// --- motion (spec §13.21): Splits is the entrance PlayerSheet's expanded
// region reveals as it mounts (peek -> expanded), so the root it shares
// with the full page crossfades in rather than hard-cutting into place. ---

test('the Splits root carries the entrance crossfade (.xfade-in)', () => {
  const { container } = render(
    <Splits bio={outfieldBio} stats={outfieldStats} comp={{ id: 'sco.1', name: 'Scottish Premiership' }} />,
  );
  expect(container.firstChild).toHaveClass('xfade-in');
});
