import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';

// Reads the router's live location so tests can see the state a Link sent.
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="loc-club">{location.state?.club ?? ''}</span>;
}
import { beforeEach, expect, test, vi } from 'vitest';

// The dossier's four raw fetch hooks (spec §13.37) join usePlayer in the
// factory — disabled-shaped stubs by default, so every pre-dossier test
// still sees today's sheet exactly.
vi.mock('../../data/queries.js', () => ({
  usePlayer: vi.fn(),
  useWikiSummary: vi.fn(() => ({ data: undefined })),
  useWikiSearch: vi.fn(() => ({ data: undefined })),
  useFplIndex: vi.fn(() => ({ data: undefined })),
  useTsdbPlayers: vi.fn(() => ({ data: undefined })),
}));

import PlayerSheet from './PlayerSheet.jsx';
import {
  usePlayer, useFplIndex, useTsdbPlayers, useWikiSearch, useWikiSummary,
} from '../../data/queries.js';
import { byId } from '../../domain/competitions.js';

beforeEach(() => {
  useWikiSummary.mockReset().mockReturnValue({ data: undefined });
  useWikiSearch.mockReset().mockReturnValue({ data: undefined });
  useFplIndex.mockReset().mockReturnValue({ data: undefined });
  useTsdbPlayers.mockReset().mockReturnValue({ data: undefined });
});

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

// A sheet container query shared by the drag tests below — the outer
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

test('an upward drag of 40px+ on the sheet expands it from the peek', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  fireEvent.pointerDown(el, { clientX: 10, clientY: 500 });
  fireEvent.pointerUp(el, { clientX: 10, clientY: 380 });
  expect(screen.getByText('Attacking')).toBeInTheDocument();
});

test('a downward drag of 40px+ while expanded and scrolled to top collapses back to the peek', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  fireEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  expect(screen.getByText('Attacking')).toBeInTheDocument();

  fireEvent.pointerDown(el, { clientX: 10, clientY: 200 });
  fireEvent.pointerUp(el, { clientX: 10, clientY: 340 });
  // Content stays mounted (clipped to height 0 by Collapse) rather than
  // unmounting, so the close glide has real content to shut around
  // instead of an already-empty box (fix round 1, HIGH).
  expect(screen.getByText('Attacking')).toBeInTheDocument();
  expect(container.querySelector('.collapse-glide').style.height).toBe('0px');
  expect(onClose).not.toHaveBeenCalled();
});

test('the same downward drag while already collapsed closes — onClose when the settle lands', () => {
  vi.useFakeTimers();
  try {
    usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
    const onClose = vi.fn();
    const { container } = render(
      <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
    );
    const el = sheetEl(container);
    fireEvent.pointerDown(el, { clientX: 10, clientY: 200 });
    fireEvent.pointerUp(el, { clientX: 10, clientY: 340 });
    // The sheet flies off with its content still aboard (320px is the
    // jsdom fallback height); the caller hears onClose only on landing,
    // so a mid-flight grab can still rescue it.
    expect(el.style.transform).toBe('translateY(320px)');
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(onClose).toHaveBeenCalled();
    expect(el.style.transform).toBe('');
  } finally { vi.useRealTimers(); }
});

test('a downward drag while expanded but scrolled away from top is a scroll, not a collapse', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  const scrollArea = container.querySelector('[class*="overflow-y-auto"]');
  Object.defineProperty(scrollArea, 'scrollTop', { value: 50, configurable: true });

  const el = sheetEl(container);
  fireEvent.pointerDown(el, { clientX: 10, clientY: 200 });
  fireEvent.pointerUp(el, { clientX: 10, clientY: 340 });
  expect(screen.getByText('Attacking')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test('a horizontal-dominant drag on the sheet is ignored', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  fireEvent.pointerDown(el, { clientX: 10, clientY: 400 });
  fireEvent.pointerUp(el, { clientX: 200, clientY: 360 });
  expect(screen.queryByText('Attacking')).not.toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

// ——— the vaul physics (spec §13.50) ———

test('the sheet tracks the finger 1:1 — every move writes the transform, both directions', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  fireEvent.pointerDown(el, { clientX: 10, clientY: 500 });
  fireEvent.pointerMove(el, { clientX: 10, clientY: 560 });
  expect(el.style.transform).toBe('translateY(60px)');
  // grab-and-reverse mid-gesture: the transform follows back up
  fireEvent.pointerMove(el, { clientX: 12, clientY: 540 });
  expect(el.style.transform).toBe('translateY(40px)');
  // a cancelled gesture glides home rather than sticking
  fireEvent.pointerCancel(el);
  expect(el.style.transform).toBe('translateY(0px)');
});

test('an upward pull at the peek rubber-bands — resisted display, never 1:1 past the boundary', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  fireEvent.pointerDown(el, { clientX: 10, clientY: 500 });
  fireEvent.pointerMove(el, { clientX: 10, clientY: 440 });
  const m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform);
  expect(m).not.toBeNull();
  const y = parseFloat(m[1]);
  expect(y).toBeLessThan(-20);
  expect(y).toBeGreaterThan(-35); // 60px of pull shows ~30 against the 320px fallback
});

test('a 30px flick — under the distance line — projects past it and closes', () => {
  vi.useFakeTimers();
  const onClose = vi.fn();
  let t = 0;
  const perf = vi.spyOn(performance, 'now').mockImplementation(() => t);
  try {
    usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
    const { container } = render(
      <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
    );
    const el = sheetEl(container);
    fireEvent.pointerDown(el, { clientX: 10, clientY: 200 });
    t = 16; fireEvent.pointerMove(el, { clientX: 10, clientY: 210 });
    t = 32; fireEvent.pointerMove(el, { clientX: 10, clientY: 220 });
    t = 48; fireEvent.pointerMove(el, { clientX: 10, clientY: 230 });
    fireEvent.pointerUp(el, { clientX: 10, clientY: 230 });
    vi.advanceTimersByTime(600);
    expect(onClose).toHaveBeenCalled();
  } finally { perf.mockRestore(); vi.useRealTimers(); }
});

test('the same 30px without momentum springs back — a settle transition home, no close', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  fireEvent.pointerDown(el, { clientX: 10, clientY: 200 });
  fireEvent.pointerMove(el, { clientX: 10, clientY: 215 });
  fireEvent.pointerMove(el, { clientX: 10, clientY: 230 });
  fireEvent.pointerUp(el, { clientX: 10, clientY: 230 });
  expect(onClose).not.toHaveBeenCalled();
  expect(el.style.transform).toBe('translateY(0px)');
  expect(el.style.transition).toContain('transform');
});

test('a settling sheet can be grabbed mid-flight — frozen on pointer-down, then carried', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  const el = sheetEl(container);
  // a release starts the glide home…
  fireEvent.pointerDown(el, { clientX: 10, clientY: 500 });
  fireEvent.pointerMove(el, { clientX: 10, clientY: 530 });
  fireEvent.pointerUp(el, { clientX: 10, clientY: 530 });
  expect(el.style.transition).toContain('transform');
  // …and a fresh grab catches it: the animation dies on the spot
  fireEvent.pointerDown(el, { clientX: 10, clientY: 400 });
  expect(el.style.transition).toBe('none');
  // tracking resumes from where the sheet was caught
  fireEvent.pointerMove(el, { clientX: 10, clientY: 480 });
  expect(el.style.transform).toBe('translateY(80px)');
});

test('a hard flick down while expanded closes outright — past the peek entirely', () => {
  vi.useFakeTimers();
  const onClose = vi.fn();
  let t = 0;
  const perf = vi.spyOn(performance, 'now').mockImplementation(() => t);
  try {
    usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
    const { container } = render(
      <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
    const el = sheetEl(container);
    fireEvent.pointerDown(el, { clientX: 10, clientY: 200 });
    t = 16; fireEvent.pointerMove(el, { clientX: 10, clientY: 230 });
    t = 32; fireEvent.pointerMove(el, { clientX: 10, clientY: 260 });
    fireEvent.pointerUp(el, { clientX: 10, clientY: 260 });
    vi.advanceTimersByTime(600);
    expect(onClose).toHaveBeenCalled();
  } finally { perf.mockRestore(); vi.useRealTimers(); }
});

test('reduced motion still tracks 1:1 but every release settles instantly — no transition, sync close', () => {
  const realMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  });
  try {
    usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
    const onClose = vi.fn();
    const { container } = render(
      <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>,
    );
    const el = sheetEl(container);
    fireEvent.pointerDown(el, { clientX: 10, clientY: 200 });
    fireEvent.pointerMove(el, { clientX: 10, clientY: 250 });
    expect(el.style.transform).toBe('translateY(50px)'); // direct manipulation is not an animation
    fireEvent.pointerUp(el, { clientX: 10, clientY: 340 });
    expect(onClose).toHaveBeenCalled();
    expect(el.style.transform).toBe('');
    expect(el.style.transition).toBe('');
  } finally { window.matchMedia = realMatchMedia; }
});

test('the Full profile control is retired — the anchor bar alone expands (user trim, 2026-08-25)', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.queryByText(/Full profile/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
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

// --- the Scout's Dossier (spec §13.37), a size down: 72×92 plate left of
// the name block, bio paragraph below the Headline numbers clamped to two
// lines until the sheet expands, the same credit register. The sheet only
// dossiers when a caller hands it a club it genuinely knows (TeamScreen's
// squad context) — no club prop, no dossier, never a guessed club. ---

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

test('a verified face renders the 72×92 plate beside the name block, with the credit line', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  armVerifiedSummary(hoeghSummary);
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" club="Celtic" onClose={() => {}} /></MemoryRouter>,
  );

  const img = container.querySelector('img');
  expect(img).toBeTruthy();
  expect(img).toHaveAttribute('src', hoeghSummary.portrait);
  expect(img).toHaveAttribute('alt', '');
  expect(img).toHaveAttribute('loading', 'lazy');
  expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(img.className).toContain('w-[72px]');
  expect(img.className).toContain('h-[92px]');
  expect(img.className).toContain('rounded-[4px]');
  expect(img.className).toContain('border-ink/35');
  expect(img.className).toContain('object-cover');
  expect(img.className).toContain('bg-drawer');
  // The plate sits in the same flex row as the name column.
  expect(img.parentElement).toContainElement(screen.getByText('Kasper Høgh'));

  const credit = screen.getByText('Photograph · Wikimedia Commons');
  expect(credit.className).toContain('text-[8.5px]');
  expect(credit.className).toContain('uppercase');
  expect(credit.className).toContain('tracking-[.14em]');
  expect(credit.className).toContain('text-muted');
});

test('the bio paragraph sits below the Headline numbers, box-clamped to 2 lines until expanded', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  armVerifiedSummary(hoeghSummary);
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" club="Celtic" onClose={() => {}} /></MemoryRouter>,
  );

  const para = screen.getByText(hoeghSummary.extract);
  expect(para.className).toContain('font-serif');
  expect(para.className).toContain('text-[13.5px]');
  expect(para.className).toContain('leading-relaxed');
  // Below the Headline grid in document order.
  const headline = container.querySelector('.grid-cols-3');
  expect(headline.compareDocumentPosition(para) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // Collapsed: the house box-clamp (Papers' technique) pins two lines.
  expect(para.getAttribute('style')).toContain('-webkit-box');
  expect(para.getAttribute('style')).toContain('hidden');

  await userEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  // Expanded: the clamp lifts and the paragraph runs free.
  expect(screen.getByText(hoeghSummary.extract).getAttribute('style') ?? '').not.toContain('-webkit-box');
});

test('THE LAW on the sheet: an unverified extract leaves the sheet byte-identical to today', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  armVerifiedSummary({
    ...hoeghSummary,
    extract: 'Kasper Høgh is a striker who plays for Rangers.',
  });
  const { container: missed } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" club="Celtic" onClose={() => {}} /></MemoryRouter>,
  );

  useWikiSummary.mockReset().mockReturnValue({ data: undefined });
  const { container: today } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" club="Celtic" onClose={() => {}} /></MemoryRouter>,
  );
  expect(missed.innerHTML).toBe(today.innerHTML);
  expect(missed.querySelector('img')).toBeNull();
  expect(within(missed).queryByText(/^Photograph ·/)).not.toBeInTheDocument();
});

test('no club prop → no dossier: every fetch hook stays armed false', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  for (const call of useWikiSummary.mock.calls) expect(call[1]).toBe(false);
  for (const call of useWikiSearch.mock.calls) expect(call[1]).toBe(false);
  expect(useFplIndex).toHaveBeenCalledWith(false);
  for (const call of useTsdbPlayers.mock.calls) expect(call[1]).toBe(false);
});

// --- the Scout Player reel (spec §13.35) ---
vi.mock('../match/video.js', () => ({
  usePlayerVideos: vi.fn(() => ({ data: undefined, isLoading: false })),
  youtubeKey: vi.fn(() => 'k'),
}));
const videoMod = await import('../match/video.js');

test("a 'Scout player' control shows once the bio lands, and tapping it opens the reel", async () => {
  const user = userEvent.setup();
  usePlayer.mockReturnValue({
    bio: { id: 'p1', name: 'Cláudio Braga', position: 'Forward' },
    stats: null, isLoading: false, isError: false,
  });
  videoMod.usePlayerVideos.mockImplementation((player, enabled) => (
    enabled
      ? { data: [{ videoId: 'v1', title: 'Braga highlights' }], isLoading: false }
      : { data: undefined, isLoading: false }
  ));
  render(<MemoryRouter>
    <PlayerSheet comp={byId('sco.1')} playerId="p1" onClose={() => {}} />
  </MemoryRouter>);
  const scout = await screen.findByRole('button', { name: /Scout player/ });
  await user.click(scout);
  expect(await screen.findByTitle('Braga highlights')).toBeInTheDocument();
});

test('"Open as page →" hands the club forward as location state (spec §13.37)', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  render(<MemoryRouter>
    <LocationProbe />
    <PlayerSheet comp={comp} playerId="272624" onClose={() => {}} club="Celtic" />
  </MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: 'Expand profile' }));
  await userEvent.click(screen.getByRole('link', { name: /Open as page/ }));
  expect(screen.getByTestId('loc-club').textContent).toBe('Celtic');
});
