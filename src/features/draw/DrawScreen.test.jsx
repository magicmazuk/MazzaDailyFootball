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
import { TIMINGS, scatterShuffle } from './drawEngine.js';
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
          <Route path="draw/:compId/:round/:teamId" element={<DrawScreen />} />
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

// --- display shuffle (hotfix: the bowl no longer telegraphs the draw) ---

// The pool's crest order, as rendered — the DOM order of the "Still in
// the hat" items, read via each Crest's accessible name (bowlEvents'
// clubs are crestless, so Crest renders the monogram span with
// aria-label={side.name}).
const poolOrder = () => [...document.querySelectorAll('.draw-pool-item [aria-label]')]
  .map(el => el.getAttribute('aria-label'));

test("the bowl pool's display order does not start with the first tie's two clubs, for the real seed used", async () => {
  stubScoreboard(bowlEvents);
  renderAt('/draw/sco.tennents/fourth-round');
  await screen.findByText('Tap to draw the first ball');

  // Identity (tie) order would be Celtic, Rangers, Aberdeen, Hibernian,
  // Hearts, Dundee — the exact bug report: "the leftmost badges are
  // always the next pairing". The seeded shuffle for this ceremony's real
  // seed (sco.tennents:fourth-round) must not reproduce that order.
  const order = poolOrder();
  expect(order).toHaveLength(6);
  expect(order).not.toEqual(['Celtic', 'Rangers', 'Aberdeen', 'Hibernian', 'Hearts', 'Dundee']);
  expect(order.slice(0, 2)).not.toEqual(['Celtic', 'Rangers']);
});

test('the bowl pool order stays stable as clubs leave — the remainder is always a filtered slice of the same permutation', async () => {
  stubScoreboard(bowlEvents);
  renderAt('/draw/sco.tennents/fourth-round');
  await screen.findByText('Tap to draw the first ball');

  const before = poolOrder();
  expect(before).toHaveLength(6);

  vi.useFakeTimers();
  fireEvent.click(drawButton()); // lands Celtic (tie0-home) — the first ball drawn regardless of display order
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.tumble); });
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.holdOpen); });

  expect(screen.getByText('5')).toBeInTheDocument();
  const afterOne = poolOrder();
  expect(afterOne).toEqual(before.filter(name => name !== 'Celtic'));

  fireEvent.click(drawButton()); // lands Rangers (tie0-away)
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.tumble); });
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.holdOpen); });

  expect(screen.getByText('4')).toBeInTheDocument();
  const afterTwo = poolOrder();
  expect(afterTwo).toEqual(afterOne.filter(name => name !== 'Rangers'));
});

test("the bowl pool's shuffled order is identical across two fresh visits to the same round (deterministic replay)", async () => {
  stubScoreboard(bowlEvents);
  const first = renderAt('/draw/sco.tennents/fourth-round');
  await screen.findByText('Tap to draw the first ball');
  const firstOrder = poolOrder();
  first.unmount();

  stubScoreboard(bowlEvents);
  renderAt('/draw/sco.tennents/fourth-round');
  await screen.findByText('Tap to draw the first ball');
  expect(poolOrder()).toEqual(firstOrder);
});

test('the roll-call list also renders its ties in a shuffled display order, not tie order', async () => {
  stubScoreboard(rollcallEvents);
  renderAt('/draw/sco.tennents/first-round');
  await screen.findByText('Tap to draw the first tie');

  const rollcallList = document.querySelector('.columns-2');
  const names = within(rollcallList).getAllByText(/^(Home|Away) \d$/).map(el => el.textContent);
  // Identity order pairs up as Home 0, Away 0, Home 1, Away 1, Home 2, Away 2, ...
  // — the seeded shuffle for this round must not reproduce that sequence.
  expect(names).not.toEqual(
    Array.from({ length: 9 }, (_, i) => [`Home ${i}`, `Away ${i}`]).flat(),
  );
});

test('the roll-call "currently drawing" highlight tracks the right tie through the shuffle, not its shuffled position', async () => {
  stubScoreboard(rollcallEvents);
  renderAt('/draw/sco.tennents/first-round');
  await screen.findByText('Tap to draw the first tie');

  vi.useFakeTimers();
  fireEvent.click(drawButton()); // draws tie 0
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.rollcallGap * 2); });
  expect(screen.getByText('16')).toBeInTheDocument(); // tie 0 landed

  fireEvent.click(drawButton()); // now drawing tie 1 — landed hasn't advanced yet
  const rollcallList = document.querySelector('.columns-2');
  expect(within(rollcallList).getByText('Home 0')).toHaveClass('line-through');
  expect(within(rollcallList).getByText('Away 0')).toHaveClass('line-through');
  expect(within(rollcallList).getByText('Home 1')).toHaveClass('text-accent');
  expect(within(rollcallList).getByText('Away 1')).toHaveClass('text-accent');
  expect(within(rollcallList).getByText('Home 1')).not.toHaveClass('line-through');
});

// --- club-level roll-call shuffle (fix: the roll call telegraphed pairings
// — shuffling TIES still rendered each tie's two clubs as adjacent lines,
// which reads as the pairing before the draw; the list must shuffle at the
// CLUB level so pairs scatter). Ceremony runs the rollcall list through
// scatterShuffle (drawEngine.js), which re-salts a plain seededShuffle
// until no tie's two clubs are consecutive — a GUARANTEE (barring a
// pathologically tiny round, covered by scatterShuffle's own unit tests in
// drawEngine.test.js), not a property of one hand-picked seed/fixture. So
// this suite's regular rollcallEvents/`first-round` fixture is used
// directly — no special seed needed, and it's the same fixture that
// demonstrably had adjacent pairs under the old plain-seededShuffle
// rendering, making it the most direct proof the fix works.
const rollcallDisplayNames = () => {
  const rollcallList = document.querySelector('.columns-2');
  return within(rollcallList).getAllByText(/^(Home|Away) \d$/).map(el => el.textContent);
};

// The same 9-tie/18-club shape as rollcallEvents, as plain {teamId, name}
// club/tie objects — what scatterShuffle itself takes, so the rendered DOM
// order can be asserted directly against the pure function's output.
const rollcallTies = Array.from({ length: 9 }, (_, i) => ({
  id: `r${i}`,
  home: { teamId: `h${i}`, name: `Home ${i}` },
  away: { teamId: `a${i}`, name: `Away ${i}` },
}));

test('the roll-call list renders clubs in scatterShuffle order — club-level, matching the pure function directly', async () => {
  stubScoreboard(rollcallEvents);
  renderAt('/draw/sco.tennents/first-round');
  await screen.findByText('Tap to draw the first tie');

  const allClubs = rollcallTies.flatMap(t => [t.home, t.away]);
  const expectedOrder = scatterShuffle(allClubs, rollcallTies, 'sco.tennents:first-round').map(c => c.name);

  expect(rollcallDisplayNames()).toEqual(expectedOrder);
});

test('the roll-call list never seats a tie\'s two clubs adjacently — pairings are not readable before the draw (guaranteed by scatterShuffle)', async () => {
  stubScoreboard(rollcallEvents);
  renderAt('/draw/sco.tennents/first-round');
  await screen.findByText('Tap to draw the first tie');

  const positions = new Map(rollcallDisplayNames().map((name, i) => [name, i]));
  for (let i = 0; i < 9; i += 1) {
    const homePos = positions.get(`Home ${i}`);
    const awayPos = positions.get(`Away ${i}`);
    expect(Math.abs(homePos - awayPos)).not.toBe(1);
  }
});

// --- status-key collision (fix: clubKey = teamId ?? name collided when two
// teamId-less clubs share a name — both would show landed/current from a
// single Set-membership check. Statuses are now POSITIONAL, matched by
// occurrence count, so exactly the club that actually landed is struck. ---

// 10 ties: 8 ordinary (16 distinct-id clubs) plus two ties each featuring a
// teamId-less "St Mirren" — a real case class (domain/draws.js' own
// pairSideKey falls back to name the same way for a side with no id yet).
// The two "St Mirren"s are genuinely different clubs that happen to share
// a display name; the OTHER side of each tie differs (Queens Park vs Ayr
// United), so they're distinct pairings, not a two-legged replay of each
// other. Kickoffs keep the St Mirren/Queens Park tie earliest (tie 0, the
// first one landed by a single TAP) and St Mirren/Ayr United latest (the
// last tie, never landed in this test) so which occurrence struck through
// is unambiguous. 18 non-null distinct ids (the two St Mirrens don't count
// — distinctClubCount skips null teamIds) keeps this comfortably in
// rollcall mode.
const collisionEvents = [
  teamEvent('sm-qp', '2026-11-01T15:00:00Z', null, 'St Mirren', 'qp', 'Queens Park', 'collision-round'),
  ...Array.from({ length: 8 }, (_, i) =>
    teamEvent(`col${i}`, `2026-11-0${i + 2}T15:00:00Z`, `ch${i}`, `Home ${i}`, `ca${i}`, `Away ${i}`, 'collision-round')),
  teamEvent('ay-sm', '2026-11-10T15:00:00Z', 'ay', 'Ayr United', null, 'St Mirren', 'collision-round'),
];

test('two teamId-less clubs sharing a name are tracked independently — landing one does not strike the other', async () => {
  stubScoreboard(collisionEvents);
  renderAt('/draw/sco.tennents/collision-round');
  await screen.findByText('Tap to draw the first tie');

  const rollcallList = document.querySelector('.columns-2');
  expect(within(rollcallList).getAllByText('St Mirren')).toHaveLength(2);

  vi.useFakeTimers();
  fireEvent.click(drawButton()); // lands tie 0: St Mirren (h) v Queens Park — earliest kickoff
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.rollcallGap * 2); });

  const stMirrenEls = within(rollcallList).getAllByText('St Mirren');
  expect(stMirrenEls).toHaveLength(2); // the list never shrinks
  const struck = stMirrenEls.filter(el => el.classList.contains('line-through'));
  expect(struck).toHaveLength(1); // exactly the landed occurrence, not both, not neither
  expect(within(rollcallList).getByText('Queens Park')).toHaveClass('line-through');
});

test('a tap highlights both current clubs wherever they land in the shuffle, then strikes both through once landed — the list never shrinks', async () => {
  stubScoreboard(rollcallEvents);
  renderAt('/draw/sco.tennents/first-round');
  await screen.findByText('Tap to draw the first tie');

  const rollcallList = document.querySelector('.columns-2');
  expect(within(rollcallList).getAllByText(/^(Home|Away) \d$/)).toHaveLength(18);

  vi.useFakeTimers();
  fireEvent.click(drawButton()); // starts drawing tie 0 (Home 0 / Away 0)

  // Both clubs of the tie being drawn are highlighted, wherever they sit in
  // the shuffled display order — and not yet struck through.
  expect(within(rollcallList).getByText('Home 0')).toHaveClass('text-accent');
  expect(within(rollcallList).getByText('Away 0')).toHaveClass('text-accent');
  expect(within(rollcallList).getByText('Home 0')).not.toHaveClass('line-through');
  expect(within(rollcallList).getByText('Away 0')).not.toHaveClass('line-through');

  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.rollcallGap * 2); });

  expect(within(rollcallList).getByText('Home 0')).toHaveClass('line-through');
  expect(within(rollcallList).getByText('Away 0')).toHaveClass('line-through');
  // The list is never filtered down as clubs land — only their style changes.
  expect(within(rollcallList).getAllByText(/^(Home|Away) \d$/)).toHaveLength(18);
});

// --- two-legged rounds (hotfix-two-leg-draw): a ceremony draws PAIRINGS,
// not legs — 7 pairings × 2 legs = 14 fixtures must collapse to 7 tie rows
// and a 14-unique-club pool, not 14 rows / a duplicate-riddled pool. ---

// 7 pairings, 2 legs each (14 fixtures, 14 distinct clubs): leg 1 is the
// earlier kickoff at the original venue, leg 2 the later, reversed-venue
// return leg — same unordered pair both times.
const twoLegEvents = Array.from({ length: 7 }, (_, i) => [
  teamEvent(`leg1-${i}`, `2026-11-0${i + 1}T15:00:00Z`, `h${i}`, `Home ${i}`, `a${i}`, `Away ${i}`, 'playoff-round'),
  teamEvent(`leg2-${i}`, `2026-11-2${i + 1}T15:00:00Z`, `a${i}`, `Away ${i}`, `h${i}`, `Home ${i}`, 'playoff-round'),
]).flat();

test('a two-legged round (14 fixtures) renders 7 tie rows and a 14-club pool with unique clubs, no duplicates', async () => {
  stubScoreboard(twoLegEvents);
  renderAt('/draw/uefa.champions/playoff-round');
  await screen.findByText('Tap to draw the first ball'); // 14 distinct clubs <= 16 -> bowl mode

  // Pool: 14 unique crests, no club doubled up.
  const poolLabels = [...document.querySelectorAll('.draw-pool-item [aria-label]')]
    .map(el => el.getAttribute('aria-label'));
  expect(poolLabels).toHaveLength(14);
  expect(new Set(poolLabels).size).toBe(14);
  expect(screen.getByText('14')).toBeInTheDocument(); // "Still in the hat" count

  // Tie list: one row per pairing (7), not one per fixture (14) — each row
  // renders a single 'v' separator between its two slots.
  expect(screen.getAllByText('v')).toHaveLength(7);
});

test('a two-legged round\'s completion marks ALL 14 fixtures\' tieIds seen (both legs), not just the 7 drawn representatives', async () => {
  stubScoreboard(twoLegEvents);
  const markTiesSeen = vi.fn();
  usePrefs.setState({ markTiesSeen });
  renderAt('/draw/uefa.champions/playoff-round');
  await screen.findByText('Tap to draw the first ball');

  await userEvent.setup().click(screen.getByRole('button', { name: 'Reveal the rest' }));

  expect(screen.getByText(/Draw complete/)).toBeInTheDocument();
  expect(markTiesSeen).toHaveBeenCalledTimes(1);
  const seenIds = markTiesSeen.mock.calls[0][0];
  const expectedIds = Array.from({ length: 7 }, (_, i) => [`leg1-${i}`, `leg2-${i}`])
    .flat().map(id => tieId('uefa.champions', id));
  expect([...seenIds].sort()).toEqual([...expectedIds].sort());
});

// --- opponents mode (spec §13.15, task-2 brief) ---

// Celtic's own league-phase campaign: three fixtures, mixed venues (away
// first, so the first ball drawn exercises the '(A)' marker).
const phaseEvents = [
  teamEvent('p1', '2026-11-01T15:00:00Z', 'r1', 'Rangers', 'h1', 'Celtic', 'league-phase'),
  teamEvent('p2', '2026-11-02T15:00:00Z', 'h1', 'Celtic', 'a2', 'Aberdeen', 'league-phase'),
  teamEvent('p3', '2026-11-03T15:00:00Z', 'h1', 'Celtic', 'a3', 'Hibernian', 'league-phase'),
];

test('opponents mode renders the subject club in the h1 and never in the pool', async () => {
  stubScoreboard(phaseEvents);
  renderAt('/draw/sco.tennents/league-phase/h1');

  const heading = await screen.findByRole('heading', { level: 1 });
  expect(within(heading).getByText("Celtic's League Phase draw")).toBeInTheDocument();

  // Pool crests (Crest's monogram fallback exposes each club's name as an
  // aria-label) must list every opponent and never the subject club.
  const poolLabels = [...document.querySelectorAll('.draw-pool-item [aria-label]')]
    .map(el => el.getAttribute('aria-label'));
  expect(poolLabels.sort()).toEqual(['Aberdeen', 'Hibernian', 'Rangers']);
  expect(poolLabels).not.toContain('Celtic');
});

test('a tap lands the opponent with its venue marker in the landed list', async () => {
  stubScoreboard(phaseEvents);
  renderAt('/draw/sco.tennents/league-phase/h1');
  await screen.findByRole('heading', { level: 1 });

  vi.useFakeTimers();
  fireEvent.click(drawButton());
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.tumble); });
  await act(async () => { await vi.advanceTimersByTimeAsync(TIMINGS.holdOpen); });

  // Celtic played away in the first (earliest-kickoff) fixture, so the
  // landed row reads "v Rangers (A)".
  const row = screen.getByText('Rangers').closest('div');
  expect(within(row).getByText('v')).toBeInTheDocument();
  expect(within(row).getByText('(A)')).toBeInTheDocument();
});

test('completion calls markTiesSeen with phaseTieIds exactly once', async () => {
  stubScoreboard(phaseEvents);
  const markTiesSeen = vi.fn();
  usePrefs.setState({ markTiesSeen });
  renderAt('/draw/sco.tennents/league-phase/h1');
  await screen.findByRole('heading', { level: 1 });

  await userEvent.setup().click(screen.getByRole('button', { name: 'Reveal the rest' }));

  expect(markTiesSeen).toHaveBeenCalledTimes(1);
  expect(markTiesSeen).toHaveBeenCalledWith(
    ['p1', 'p2', 'p3'].map(id => tieId('sco.tennents', id)),
  );
});

test('an already-seen phase round opens straight into complete, with no re-marking', async () => {
  stubScoreboard(phaseEvents);
  usePrefs.setState({
    seenTies: Object.fromEntries(['p1', 'p2', 'p3'].map(id => [tieId('sco.tennents', id), true])),
  });
  const markTiesSeen = vi.fn();
  usePrefs.setState({ markTiesSeen });

  renderAt('/draw/sco.tennents/league-phase/h1');

  expect(await screen.findByText(/Draw complete/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start again' })).toBeInTheDocument();
  expect(markTiesSeen).not.toHaveBeenCalled();
});
