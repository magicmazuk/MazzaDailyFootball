import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

// The dossier's four raw fetch hooks (spec §13.37) join usePlayer in the
// factory — disabled-shaped stubs by default, so every pre-dossier test
// still sees today's page exactly.
vi.mock('../../data/queries.js', () => ({
  usePlayer: vi.fn(),
  useWikiSummary: vi.fn(() => ({ data: undefined })),
  useWikiSearch: vi.fn(() => ({ data: undefined })),
  useFplIndex: vi.fn(() => ({ data: undefined })),
  useTsdbPlayers: vi.fn(() => ({ data: undefined })),
}));
// The page scouts too (spec §13.35) — stubbed like the sheet's harness.
vi.mock('../match/video.js', () => ({
  usePlayerVideos: vi.fn(() => ({ data: undefined, isLoading: false })),
  youtubeKey: vi.fn(() => 'k'),
}));
import userEvent from '@testing-library/user-event';

import PlayerScreen, { Splits } from './PlayerScreen.jsx';
import {
  usePlayer, useFplIndex, useTsdbPlayers, useWikiSearch, useWikiSummary,
} from '../../data/queries.js';

beforeEach(() => {
  useWikiSummary.mockReset().mockReturnValue({ data: undefined });
  useWikiSearch.mockReset().mockReturnValue({ data: undefined });
  useFplIndex.mockReset().mockReturnValue({ data: undefined });
  useTsdbPlayers.mockReset().mockReturnValue({ data: undefined });
});

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

// --- the Scout's Dossier (spec §13.37, pick D-B: the profile column) ---
// A verified identity prints a plate + bio paragraph + credit; a face-less
// verified bio prints full-width; anything unverified leaves the page
// byte-identical to today — THE LAW.

const hoeghSummary = {
  title: 'Kasper Høgh',
  kind: 'standard',
  extract: 'Kasper Høgh is a Danish professional footballer who plays as a '
    + 'striker for Scottish Premiership club Celtic.',
  portrait: 'https://upload.wikimedia.org/thumb/hoegh.jpg',
  original: 'https://upload.wikimedia.org/hoegh.jpg',
};

function armVerifiedSummary(summary) {
  useWikiSummary.mockImplementation(title => (
    title === summary.title ? { data: summary, isSuccess: true } : { data: undefined }));
}

test('a verified face renders the profile column: plate beside the name/meta/bio text column', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  armVerifiedSummary(hoeghSummary);
  const { container } = renderAt('sco.1', '272624', { club: 'Celtic' });

  const img = container.querySelector('img');
  expect(img).toBeTruthy();
  expect(img).toHaveAttribute('src', hoeghSummary.portrait);
  expect(img).toHaveAttribute('alt', '');
  expect(img).toHaveAttribute('loading', 'lazy');
  expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(img.className).toContain('w-[96px]');
  expect(img.className).toContain('h-[122px]');
  expect(img.className).toContain('rounded-[4px]');
  expect(img.className).toContain('border-ink/35');
  expect(img.className).toContain('object-cover');
  expect(img.className).toContain('bg-drawer');

  // The flex row: plate left, min-w-0 text column with name + meta + bio.
  const row = img.parentElement;
  expect(row.className).toContain('flex');
  expect(row.className).toContain('items-start');
  expect(row.className).toContain('gap-4');
  const textCol = row.querySelector('.min-w-0');
  expect(textCol).toContainElement(screen.getByText('Kasper Høgh'));
  const para = screen.getByText(hoeghSummary.extract);
  expect(textCol).toContainElement(para);
  expect(para.className).toContain('font-serif');
  expect(para.className).toContain('text-[13.5px]');
  expect(para.className).toContain('leading-relaxed');

  // The credit, in the muted 8.5px caps register, and the xfade arrival.
  const credit = screen.getByText('Photograph · Wikimedia Commons');
  expect(credit.className).toContain('text-[8.5px]');
  expect(credit.className).toContain('uppercase');
  expect(credit.className).toContain('tracking-[.14em]');
  expect(credit.className).toContain('text-muted');
  expect(container.querySelector('.xfade-in')).toContainElement(img);
});

test('bio verified but no face: the paragraph prints full-width, no plate, no credit', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  armVerifiedSummary({ ...hoeghSummary, portrait: null, original: null });
  const { container } = renderAt('sco.1', '272624', { club: 'Celtic' });

  expect(container.querySelector('img')).toBeNull();
  expect(screen.queryByText(/^Photograph ·/)).not.toBeInTheDocument();
  const para = screen.getByText(hoeghSummary.extract);
  expect(para.className).toContain('font-serif');
  expect(para.className).toContain('text-[13.5px]');
  // Full-width: no flex profile row wraps the paragraph.
  expect(para.closest('.items-start.gap-4')).toBeNull();
});

test('THE LAW: an unverified extract leaves the page byte-identical to today', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  armVerifiedSummary({
    ...hoeghSummary,
    extract: 'Kasper Høgh is a striker who plays for Rangers.',
  });
  const { container: missed } = renderAt('sco.1', '272624', { club: 'Celtic' });

  useWikiSummary.mockReset().mockReturnValue({ data: undefined });
  const { container: today } = renderAt('sco.1', '272624', { club: 'Celtic' });
  expect(missed.innerHTML).toBe(today.innerHTML);
  expect(missed.querySelector('img')).toBeNull();
});

test('no club context (no router state) arms nothing — the dossier never fetches', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  renderAt('sco.1', '272624');
  for (const call of useWikiSummary.mock.calls) expect(call[1]).toBe(false);
  expect(useFplIndex).toHaveBeenCalledWith(false);
  for (const call of useTsdbPlayers.mock.calls) expect(call[1]).toBe(false);
});

test("the page carries the 'Scout player' control and opens the reel on tap (spec §13.35)", async () => {
  const videoMod = await import('../match/video.js');
  videoMod.usePlayerVideos.mockImplementation((player, enabled) => (
    enabled ? { data: [{ videoId: 'v9', title: 'Reel one' }], isLoading: false }
      : { data: undefined, isLoading: false }));
  usePlayer.mockReturnValue({
    bio: { id: 'p1', name: 'Daizen Maeda', position: 'Forward' },
    stats: null, isLoading: false, isError: false,
  });
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/player/sco.1/p1']}>
      <Routes><Route path="/player/:compId/:playerId" element={<PlayerScreen />} /></Routes>
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: /Scout player/ }));
  expect(await screen.findByTitle('Reel one')).toBeInTheDocument();
});
