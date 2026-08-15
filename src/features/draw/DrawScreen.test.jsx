// Component tests for the draw ceremony (spec §8.3-8.5, task-2 brief). Fake
// timers drive the TICKs the reducer needs — the animation-timing contract
// (drawEngine.test.js) is proven separately; this file only proves the
// screen wires the engine, prefs and routing together correctly.
//
// fireEvent (not userEvent) is used for clicks once fake timers are active:
// userEvent's click() awaits an internal frame/microtask handshake that
// deadlocks against a faked clock, even with delay:null — a known
// incompatibility, not something this screen's code can work around.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import DrawScreen from './DrawScreen.jsx';
import { TIMINGS } from './drawEngine.js';
import { usePrefs, CELTIC } from '../../store/prefs.js';
import { tieId } from '../../domain/draws.js';

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({
    followed: { [CELTIC.id]: CELTIC }, hiddenComps: [],
    seenTies: {}, seenSeeded: false,
  });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Element.prototype.scrollIntoView = vi.fn();
});

const drawButton = () => screen.getByRole('button', { name: 'Draw' });

const teamEvent = (id, kickoff, homeId, homeName, awayId, awayName, roundSlug = 'fourth-round') => ({
  id, date: kickoff, status: { type: { name: 'STATUS_SCHEDULED' } }, season: { slug: roundSlug },
  competitions: [{ competitors: [
    { homeAway: 'home', team: { id: homeId, displayName: homeName } },
    { homeAway: 'away', team: { id: awayId, displayName: awayName } },
  ] }],
});

// A small (bowl-mode) round: 3 ties, 6 distinct clubs.
const bowlEvents = [
  teamEvent('e1', '2026-11-01T15:00:00Z', 'h1', 'Celtic', 'a1', 'Rangers'),
  teamEvent('e2', '2026-11-02T15:00:00Z', 'h2', 'Aberdeen', 'a2', 'Hibernian'),
  teamEvent('e3', '2026-11-03T15:00:00Z', 'h3', 'Hearts', 'a3', 'Dundee'),
];

// A large (rollcall-mode) round: 9 ties, 18 distinct clubs.
const rollcallEvents = Array.from({ length: 9 }, (_, i) =>
  teamEvent(`r${i}`, `2026-11-0${(i % 9) + 1}T15:00:00Z`, `h${i}`, `Home ${i}`, `a${i}`, `Away ${i}`, 'first-round'));

function stubScoreboard(events) {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ events }), { status: 200 })));
}

function renderAt(path) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="draw/:compId/:round" element={<DrawScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// --- guards ---

test('an unknown competition shows the honest line, not a white screen', async () => {
  stubScoreboard([]);
  renderAt('/draw/does-not-exist/fourth-round');
  expect(screen.getByText('Unknown competition.')).toBeInTheDocument();
});

test('a round with no fixtures shows the honest line and a link back to the competition', async () => {
  stubScoreboard(bowlEvents); // all 'fourth-round' — asking for a different round finds none
  renderAt('/draw/sco.tennents/fifth-round');
  await screen.findByText("This draw isn't available.");
  expect(screen.getByRole('link', { name: /Scottish Cup/ })).toHaveAttribute('href', '/competition/sco.tennents');
});

// --- bowl mode ---

test('bowl mode starts idle with the first-ball hint and the full pool count', async () => {
  stubScoreboard(bowlEvents);
  renderAt('/draw/sco.tennents/fourth-round');
  expect(await screen.findByText('Tap to draw the first ball')).toBeInTheDocument();
  expect(screen.getByText('Still in the hat')).toBeInTheDocument();
  expect(screen.getByText('6')).toBeInTheDocument(); // 3 ties = 6 clubs
});

test('a tap lands the first club in the tie list and shrinks the pool count, after the pacing elapses', async () => {
  stubScoreboard(bowlEvents);
  renderAt('/draw/sco.tennents/fourth-round');
  await screen.findByText('Tap to draw the first ball');

  // Switch to fake timers only now that the async fixture load has settled
  // — findByText polls on real timers, so faking the clock any earlier
  // would deadlock it.
  vi.useFakeTimers();
  fireEvent.click(drawButton());
  // Advanced in two steps, each flushed through act(): the tumbling->revealed
  // TICK schedules a *new* effect/timeout for the hold-open leg, and that
  // rescheduling needs its own commit to land before advancing past it.
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.tumble); });
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.holdOpen); });

  expect(screen.getByText('Celtic')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument(); // pool shrank from 6 to 5
  expect(screen.getByText('Tap for the next ball')).toBeInTheDocument();
});

test('a tap mid-animation is ignored — only one ball lands, not two', async () => {
  stubScoreboard(bowlEvents);
  renderAt('/draw/sco.tennents/fourth-round');
  await screen.findByText('Tap to draw the first ball');

  vi.useFakeTimers();
  fireEvent.click(drawButton());
  // Still tumbling — further clicks here must be a no-op.
  fireEvent.click(drawButton());
  fireEvent.click(drawButton());
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.tumble); });
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.holdOpen); });

  expect(screen.getByText('5')).toBeInTheDocument(); // exactly one ball landed
  expect(screen.queryByText('4')).not.toBeInTheDocument();
});

test("the bowl pool jumble is stable — an untouched club's transform is unchanged after another ball lands", async () => {
  stubScoreboard(bowlEvents);
  renderAt('/draw/sco.tennents/fourth-round');
  await screen.findByText('Tap to draw the first ball');

  // Rangers is tie0-away — the second ball drawn, untouched by landing the
  // first (Celtic, tie0-home).
  const rangersBefore = screen.getByLabelText('Rangers').closest('.draw-pool-item').getAttribute('style');

  vi.useFakeTimers();
  fireEvent.click(drawButton());
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.tumble); });
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.holdOpen); });

  expect(screen.getByText('5')).toBeInTheDocument(); // Celtic landed, pool shrank
  const rangersAfter = screen.getByLabelText('Rangers').closest('.draw-pool-item').getAttribute('style');
  expect(rangersAfter).toBe(rangersBefore);
});

test('the stage shows "Draw complete" once every ball has landed by tapping through', async () => {
  stubScoreboard(bowlEvents);
  renderAt('/draw/sco.tennents/fourth-round');
  await screen.findByText('Tap to draw the first ball');

  vi.useFakeTimers();
  for (let i = 0; i < bowlEvents.length * 2; i += 1) {
    fireEvent.click(drawButton());
    await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.tumble); });
    await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.holdOpen); });
  }

  expect(screen.getByText(/Draw complete/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start again' })).toBeInTheDocument();
});

test('Reveal the rest completes the draw and calls markTiesSeen once with every tie id', async () => {
  stubScoreboard(bowlEvents);
  // A fresh vi.fn(), installed via setState (not vi.spyOn on a getState()
  // snapshot) *before* mount: the screen captures usePrefs' markTiesSeen
  // reference via a selector at render time, so patching it after mount
  // would leave the already-rendered closure pointing at the original.
  // vi.spyOn on a getState() snapshot is unsafe here — zustand's setState
  // merges into a *new* state object on every update, so a spy mutated
  // onto one snapshot silently survives (uncleared) inside every later
  // merged object, leaking a stale call history into whichever test next
  // spies on the same key.
  const markTiesSeen = vi.fn();
  usePrefs.setState({ markTiesSeen });
  renderAt('/draw/sco.tennents/fourth-round');
  await screen.findByText('Tap to draw the first ball');

  await userEvent.setup().click(screen.getByRole('button', { name: 'Reveal the rest' }));

  expect(screen.getByText('Celtic')).toBeInTheDocument();
  expect(screen.getByText('Rangers')).toBeInTheDocument();
  expect(screen.getByText('Aberdeen')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start again' })).toBeInTheDocument();
  expect(screen.getByText(/Draw complete/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Done' })).toHaveAttribute('href', '/competition/sco.tennents');
  expect(markTiesSeen).toHaveBeenCalledTimes(1);
  expect(markTiesSeen).toHaveBeenCalledWith(['e1', 'e2', 'e3'].map(id => tieId('sco.tennents', id)));
});

test('an already-seen round renders straight into complete, with Start again, no re-marking', async () => {
  stubScoreboard(bowlEvents);
  usePrefs.setState({
    seenTies: Object.fromEntries(['e1', 'e2', 'e3'].map(id => [tieId('sco.tennents', id), true])),
  });
  const markTiesSeen = vi.fn();
  usePrefs.setState({ markTiesSeen });

  renderAt('/draw/sco.tennents/fourth-round');

  expect(await screen.findByText('Celtic')).toBeInTheDocument();
  expect(screen.getByText('Rangers')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start again' })).toBeInTheDocument();
  // Opens straight into complete with no animation ever having run — the
  // stage must show the completion badge, not a blank hole.
  expect(screen.getByText(/Draw complete/)).toBeInTheDocument();
  expect(markTiesSeen).not.toHaveBeenCalled();
});

// --- rollcall mode ---

test('rollcall mode is chosen for a round with more than 16 distinct clubs, and a tap lands two names', async () => {
  stubScoreboard(rollcallEvents);
  renderAt('/draw/sco.tennents/first-round');
  await screen.findByText('Tap to draw the first tie');
  expect(screen.getByText('18')).toBeInTheDocument(); // 9 ties = 18 clubs

  vi.useFakeTimers();
  fireEvent.click(drawButton());
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.rollcallGap * 2); });

  expect(screen.getByText('16')).toBeInTheDocument(); // both sides of tie 0 landed
  expect(screen.getAllByText('v').length).toBe(9);
  // Both names of the first tie now render struck-through in the roll call
  // (the tie list further down the page also shows "Home 0"/"Away 0" once
  // landed — scope to the roll call's own bordered list to disambiguate).
  const rollcallList = document.querySelector('.columns-2');
  expect(within(rollcallList).getByText('Home 0')).toHaveClass('line-through');
  expect(within(rollcallList).getByText('Away 0')).toHaveClass('line-through');
});
