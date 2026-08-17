import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

vi.mock('../../data/queries.js', () => ({ usePlayer: vi.fn() }));

import PlayerSheet from './PlayerSheet.jsx';
import { usePlayer } from '../../data/queries.js';
import { byId } from '../../domain/competitions.js';

const outfieldBio = {
  id: '272624', name: 'Kasper Høgh', position: 'Forward', shirt: '9', age: 25,
  nationality: 'Denmark', heightDisplay: "6' 1\"", birthDate: null, birthPlace: null,
};
const outfieldStats = {
  appearances: 2, starts: 2, minutes: 172, goals: 3, assists: 0,
  shotsOnTarget: 5, shotsOffTarget: 4, totalShots: 13,
  accuratePasses: 23, inaccuratePasses: 15, totalPasses: 38, passPct: 0.605,
  foulsCommitted: 3, yellowCards: 0, redCards: 0, effectiveTackles: 1,
  saves: null, cleanSheets: null, goalsConceded: null, rating: null,
};

const comp = byId('sco.1');

// A sheet container query shared by the touch tests below — the outer
// fixed div carries the translate-y-* class in both states, and nothing
// else in the tree does.
function sheetEl(container) {
  return container.querySelector('[class*="translate-y"]');
}

test('a null playerId keeps the sheet closed and off-screen', () => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId={null} onClose={() => {}} /></MemoryRouter>);
  expect(screen.queryByText('Kasper Høgh')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
});

test('a playerId opens the sheet with name, sys line and three headline numbers', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.getByText('Kasper Høgh')).toBeInTheDocument();
  expect(screen.getByText('№ 9')).toBeInTheDocument();
  expect(screen.getByText(/Forward/)).toBeInTheDocument();
  expect(screen.getByText(/Denmark/)).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument(); // goals
  expect(screen.getByText('172′')).toBeInTheDocument(); // minutes
  expect(screen.getByText('Goals')).toBeInTheDocument();
  expect(screen.getByText('Minutes')).toBeInTheDocument();
});

test('a null rating substitutes appearances as the third headline number', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.queryByText('Rating')).not.toBeInTheDocument();
  expect(screen.getByText('Games')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
});

test('a rated player shows rating as the third headline number', () => {
  usePlayer.mockReturnValue({
    bio: outfieldBio, stats: { ...outfieldStats, rating: 7.4 }, isLoading: false, isError: false,
  });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.getByText('Rating')).toBeInTheDocument();
  expect(screen.getByText('7.4')).toBeInTheDocument();
  expect(screen.queryByText('Games')).not.toBeInTheDocument();
});

test('a keeper shows saves, clean sheets and rating (or games)', () => {
  const keeperBio = { ...outfieldBio, position: 'Goalkeeper' };
  const keeperStats = { ...outfieldStats, goals: null, saves: 11, cleanSheets: 1, rating: null };
  usePlayer.mockReturnValue({ bio: keeperBio, stats: keeperStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.getByText('Saves')).toBeInTheDocument();
  expect(screen.getByText('Clean sheets')).toBeInTheDocument();
  expect(screen.getByText('11')).toBeInTheDocument();
  expect(screen.queryByText('Minutes')).not.toBeInTheDocument();
});

test('the close button calls onClose', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});

test('the backdrop dismiss button closes on tap', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>);
  await userEvent.click(screen.getByLabelText('Dismiss'));
  expect(onClose).toHaveBeenCalled();
});

test('no portrait/roundel/mark visual anywhere in the sheet', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  expect(container.querySelectorAll('[class*="mark"], [class*="roundel"], [class*="portrait"], [class*="avatar"]'))
    .toHaveLength(0);
});

// --- the sheet opens all the way (spec §13.18.3) ---

test('the handle button expands the sheet, revealing the full Splits content', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.queryByText('Attacking')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  expect(screen.getByText('Attacking')).toBeInTheDocument();
  expect(screen.getByText('13 shots — 5 on target')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument();
});

test('clicking the handle again collapses back to the peek — Splits stay mounted (clipped), headline numbers still there', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  expect(screen.getByText('Attacking')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Collapse' }));
  // Content stays mounted (clipped to height 0 by Collapse) rather than
  // unmounting, so the close glide has real content to shut around
  // instead of an already-empty box (fix round 1, HIGH).
  expect(screen.getByText('Attacking')).toBeInTheDocument();
  expect(container.querySelector('.collapse-glide').style.height).toBe('0px');
  // Splits' own stats (e.g. a "3" for fouls committed) stay in the DOM
  // too now that it's clipped rather than unmounted, so scope the
  // headline check to the Headline grid rather than a bare getByText('3'),
  // which would now be ambiguous.
  const headline = container.querySelector('.grid-cols-3');
  expect(within(headline).getByText('Goals')).toBeInTheDocument();
  expect(within(headline).getByText('3')).toBeInTheDocument();
});

test('an upward swipe of 40px+ on the sheet expands it from the peek', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  fireEvent.touchStart(el, { touches: [{ clientX: 10, clientY: 500 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 10, clientY: 380 }] });
  expect(screen.getByText('Attacking')).toBeInTheDocument();
});

test('a downward swipe of 40px+ while expanded and scrolled to top collapses back to the peek', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  fireEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  expect(screen.getByText('Attacking')).toBeInTheDocument();

  fireEvent.touchStart(el, { touches: [{ clientX: 10, clientY: 200 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 10, clientY: 340 }] });
  // Content stays mounted (clipped to height 0 by Collapse) rather than
  // unmounting, so the close glide has real content to shut around
  // instead of an already-empty box (fix round 1, HIGH).
  expect(screen.getByText('Attacking')).toBeInTheDocument();
  expect(container.querySelector('.collapse-glide').style.height).toBe('0px');
  expect(onClose).not.toHaveBeenCalled();
});

test('the same downward swipe while already collapsed calls onClose instead', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  fireEvent.touchStart(el, { touches: [{ clientX: 10, clientY: 200 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 10, clientY: 340 }] });
  expect(onClose).toHaveBeenCalled();
});

test('a downward swipe while expanded but scrolled away from top is a scroll, not a collapse', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  const scrollArea = container.querySelector('[class*="overflow-y-auto"]');
  Object.defineProperty(scrollArea, 'scrollTop', { value: 50, configurable: true });

  const el = sheetEl(container);
  fireEvent.touchStart(el, { touches: [{ clientX: 10, clientY: 200 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 10, clientY: 340 }] });
  expect(screen.getByText('Attacking')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test('a horizontal-dominant swipe on the sheet is ignored', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  fireEvent.touchStart(el, { touches: [{ clientX: 10, clientY: 400 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200, clientY: 360 }] });
  expect(screen.queryByText('Attacking')).not.toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test('tapping "Full profile →" expands the sheet without navigating', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: /Full profile/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Full profile/ }));
  expect(screen.getByText('Attacking')).toBeInTheDocument();
});

test('"Open as page →" renders as a Link with the player route href once expanded, and closes on click', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: /Open as page/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  const link = screen.getByRole('link', { name: /Open as page/ });
  expect(link).toHaveAttribute('href', '/player/sco.1/272624');
  await userEvent.click(link);
  expect(onClose).toHaveBeenCalled();
});

// --- motion (spec §13.21): the sheet opens at a stable size — a shaped
// skeleton (2 name/sys-line bars + 3 headline-number blocks, same grid
// Headline itself uses) stands in for the old thin "Loading player…" strip
// that jumped once bio landed. ---

test('open with no bio while the query is still fetching shows a skeleton (2 lines + 3 headline blocks), not "Loading player…"', () => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: true, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  expect(screen.queryByText('Loading player…')).not.toBeInTheDocument();
  const bars = container.querySelectorAll('.skeleton-pulse');
  expect(bars).toHaveLength(5); // 2 name/sys-line bars + 3 headline blocks
  bars.forEach(bar => expect(bar.closest('[aria-hidden="true"]')).toBeTruthy());
});

test('bio content carries the entrance crossfade (.xfade-in) once loaded', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  const xfade = container.querySelector('.xfade-in');
  expect(xfade).toBeInTheDocument();
  expect(within(xfade).getByText('Kasper Høgh')).toBeInTheDocument();
});

// --- peek <-> expanded (retires the parked v1.0 finding, spec §13.21): the
// old h-auto -> h-[88vh] class jump never interpolated. The expanded
// region's height is now driven by Collapse's measured-height glide. ---

test('the expanded region is driven by the Collapse glide mechanism (.collapse-glide), present even while collapsed', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  expect(container.querySelector('.collapse-glide')).toBeInTheDocument();
});

test('expanding no longer jumps the sheet to a fixed h-[88vh] class', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  expect(screen.getByText('Attacking')).toBeInTheDocument();
  expect(sheetEl(container).className).not.toMatch(/h-\[88vh\]/);
});

test('usePlayer isError shows "Player information unavailable."', () => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: true });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.getByText('Player information unavailable.')).toBeInTheDocument();
});

test('changing playerId resets expanded (and everExpanded) back to the peek — a new player\'s sheet has no Splits mounted at all, not just clipped', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { rerender, container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  expect(screen.getByText('Attacking')).toBeInTheDocument();

  const otherBio = { ...outfieldBio, id: '999', name: 'Someone Else' };
  usePlayer.mockReturnValue({ bio: otherBio, stats: outfieldStats, isLoading: false, isError: false });
  rerender(<MemoryRouter><PlayerSheet comp={comp} playerId="999" onClose={() => {}} /></MemoryRouter>);
  // Unlike a same-player collapse (fix round 1, HIGH — which now keeps
  // Splits mounted-but-clipped), a playerId change resets everExpanded
  // too, so the old player's Splits are genuinely gone from the DOM, not
  // just clipped to height 0 — the Collapse for the new player mounts
  // nothing until it's expanded again.
  expect(screen.queryByText('Attacking')).not.toBeInTheDocument();
  expect(container.querySelector('.collapse-glide').firstChild).toBeEmptyDOMElement();
  expect(screen.getByRole('button', { name: 'Expand profile' })).toBeInTheDocument();
});

// --- gold-review regressions: the closed sheet must be fully inert, and an
// open sheet must not let the page scroll away underneath (the sheet's
// promise is "close it and you're exactly where you were"). ---

test('a closed sheet renders no handle button — no invisible tap strip over the nav, no phantom tab stop', () => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId={null} onClose={() => {}} /></MemoryRouter>);
  expect(screen.queryByLabelText('Expand profile')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('opening the sheet locks body scroll and closing restores the prior value', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  document.body.style.overflow = 'scroll';
  const { rerender } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  expect(document.body.style.overflow).toBe('hidden');
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: false });
  rerender(<MemoryRouter><PlayerSheet comp={comp} playerId={null} onClose={() => {}} /></MemoryRouter>);
  expect(document.body.style.overflow).toBe('scroll');
  document.body.style.overflow = '';
});
