// Pure reducer tests for the draw ceremony (spec §8.3-8.5, task-2 brief). No
// timers, no DOM here — the component drives TICK from real animation
// timeouts; this file only proves the state machine itself is correct.
import { expect, test } from 'vitest';
import {
  TIMINGS, drawMode, drawReducer, initDraw, isComplete, landedSides, remainingClubs, scatterShuffle,
  seededShuffle,
} from './drawEngine.js';

const side = (teamId, name) => ({ teamId, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase() });
const tie = (id, home, away, kickoff) => ({ id, home, away, kickoff });

const celtic = side('1', 'Celtic');
const rangers = side('2', 'Rangers');
const aberdeen = side('3', 'Aberdeen');
const hibs = side('4', 'Hibernian');
const hearts = side('5', 'Hearts');
const dundee = side('6', 'Dundee');

const bowlTies = [
  tie('t1', celtic, rangers, '2026-08-01T15:00:00Z'),
  tie('t2', aberdeen, hibs, '2026-08-02T15:00:00Z'),
  tie('t3', hearts, dundee, '2026-08-03T15:00:00Z'),
];

// --- drawMode threshold ---

test('drawMode is bowl when the round has 16 or fewer distinct clubs', () => {
  const ties = Array.from({ length: 8 }, (_, i) =>
    tie(`t${i}`, side(`h${i}`, `Home ${i}`), side(`a${i}`, `Away ${i}`), '2026-08-01T15:00:00Z'));
  expect(drawMode(ties)).toBe('bowl'); // 8 ties = 16 distinct clubs, exactly at the threshold
});

test('drawMode is rollcall when the round has more than 16 distinct clubs', () => {
  const ties = Array.from({ length: 9 }, (_, i) =>
    tie(`t${i}`, side(`h${i}`, `Home ${i}`), side(`a${i}`, `Away ${i}`), '2026-08-01T15:00:00Z'));
  expect(drawMode(ties)).toBe('rollcall'); // 9 ties = 18 distinct clubs
});

test('a replay pair does not inflate the distinct-club count past the bowl threshold', () => {
  // 9 ties (18 sides) but one pair is a replay of an earlier tie in the same
  // round, so only 16 clubs actually appear — still bowl mode.
  const ties = Array.from({ length: 8 }, (_, i) =>
    tie(`t${i}`, side(`h${i}`, `Home ${i}`), side(`a${i}`, `Away ${i}`), '2026-08-01T15:00:00Z'));
  ties.push(tie('replay', side('h0', 'Home 0'), side('a0', 'Away 0'), '2026-08-08T15:00:00Z'));
  expect(drawMode(ties)).toBe('bowl');
});

// --- bowl mode: reveal order, TAP/TICK, remainingClubs, complete ---

test('bowl mode reveals one ball per TAP in order: tie 0 home, tie 0 away, tie 1 home, ...', () => {
  let state = initDraw(bowlTies, 'bowl');
  expect(state.phase).toBe('idle');

  state = drawReducer(state, { type: 'TAP' });
  expect(state.phase).toBe('tumbling');
  state = drawReducer(state, { type: 'TICK' });
  expect(state.phase).toBe('revealed');
  state = drawReducer(state, { type: 'TICK' });
  expect(state.phase).toBe('landed');
  expect(landedSides(state)).toEqual([
    { tie: bowlTies[0], home: true, away: false },
    { tie: bowlTies[1], home: false, away: false },
    { tie: bowlTies[2], home: false, away: false },
  ]);

  state = drawReducer(state, { type: 'TAP' });
  state = drawReducer(state, { type: 'TICK' });
  state = drawReducer(state, { type: 'TICK' });
  expect(landedSides(state)[0]).toEqual({ tie: bowlTies[0], home: true, away: true });
  expect(landedSides(state)[1]).toEqual({ tie: bowlTies[1], home: false, away: false });
});

test('TAP is ignored mid-animation (tumbling or revealed), only idle/landed accept it', () => {
  let state = initDraw(bowlTies, 'bowl');
  state = drawReducer(state, { type: 'TAP' });
  expect(state.phase).toBe('tumbling');

  const midTumble = drawReducer(state, { type: 'TAP' });
  expect(midTumble).toBe(state); // untouched — same reference, no wasted render

  state = drawReducer(state, { type: 'TICK' });
  expect(state.phase).toBe('revealed');
  const midReveal = drawReducer(state, { type: 'TAP' });
  expect(midReveal).toBe(state);
});

test('TICK is a no-op from idle or complete', () => {
  const idle = initDraw(bowlTies, 'bowl');
  expect(drawReducer(idle, { type: 'TICK' })).toBe(idle);

  const complete = drawReducer(idle, { type: 'REVEAL_REST' });
  expect(drawReducer(complete, { type: 'TICK' })).toBe(complete);
});

test('remainingClubs shrinks by one club per landed ball in bowl mode', () => {
  let state = initDraw(bowlTies, 'bowl');
  expect(remainingClubs(state)).toHaveLength(6);

  state = drawReducer(state, { type: 'TAP' });
  state = drawReducer(state, { type: 'TICK' });
  state = drawReducer(state, { type: 'TICK' });
  expect(remainingClubs(state)).toHaveLength(5);
  expect(remainingClubs(state)).not.toContain(celtic);

  state = drawReducer(state, { type: 'TAP' });
  state = drawReducer(state, { type: 'TICK' });
  state = drawReducer(state, { type: 'TICK' });
  expect(remainingClubs(state)).toHaveLength(4);
  expect(remainingClubs(state)).not.toContain(rangers);
});

test('the last ball landing takes the draw straight to complete, skipping a bare landed phase', () => {
  let state = initDraw(bowlTies, 'bowl');
  for (let i = 0; i < bowlTies.length * 2 - 1; i += 1) {
    state = drawReducer(state, { type: 'TAP' });
    state = drawReducer(state, { type: 'TICK' });
    state = drawReducer(state, { type: 'TICK' });
    expect(state.phase).toBe('landed');
  }
  state = drawReducer(state, { type: 'TAP' });
  state = drawReducer(state, { type: 'TICK' });
  state = drawReducer(state, { type: 'TICK' });
  expect(state.phase).toBe('complete');
  expect(isComplete(state)).toBe(true);
  expect(remainingClubs(state)).toHaveLength(0);
  expect(landedSides(state).every(s => s.home && s.away)).toBe(true);
});

// --- rollcall mode: one tie per TAP, both sides land together ---

const rollcallTies = Array.from({ length: 9 }, (_, i) =>
  tie(`r${i}`, side(`h${i}`, `Home ${i}`), side(`a${i}`, `Away ${i}`), '2026-08-01T15:00:00Z'));

test('rollcall mode lands both sides of a tie together, one tie per TAP', () => {
  let state = initDraw(rollcallTies, 'rollcall');
  state = drawReducer(state, { type: 'TAP' });
  expect(state.phase).toBe('drawing');
  state = drawReducer(state, { type: 'TICK' });
  expect(state.phase).toBe('landed');
  expect(landedSides(state)[0]).toEqual({ tie: rollcallTies[0], home: true, away: true });
  expect(landedSides(state)[1]).toEqual({ tie: rollcallTies[1], home: false, away: false });
});

test('remainingClubs shrinks by two clubs per landed tie in rollcall mode', () => {
  let state = initDraw(rollcallTies, 'rollcall');
  expect(remainingClubs(state)).toHaveLength(18);
  state = drawReducer(state, { type: 'TAP' });
  state = drawReducer(state, { type: 'TICK' });
  expect(remainingClubs(state)).toHaveLength(16);
});

test('rollcall TAP is ignored mid-draw', () => {
  let state = initDraw(rollcallTies, 'rollcall');
  state = drawReducer(state, { type: 'TAP' });
  const midDraw = drawReducer(state, { type: 'TAP' });
  expect(midDraw).toBe(state);
});

// --- opponents mode: one fixture per TAP, subject's side never revealed
// (spec §13.15, task-1 brief) ---

// Celtic is the subject, home in fixtures 1 and 3, away in fixture 2 —
// mixed venues on purpose. Already in kickoff order, per the input
// contract landedSides relies on.
const opponentTies = [
  tie('o1', celtic, rangers, '2026-09-01T15:00:00Z'),
  tie('o2', aberdeen, celtic, '2026-09-02T15:00:00Z'),
  tie('o3', celtic, hibs, '2026-09-03T15:00:00Z'),
];

test('opponents mode reveals one opponent per TAP, tumble->revealed->landed like bowl, with correct venue', () => {
  let state = initDraw(opponentTies, 'opponents', { subjectTeamId: celtic.teamId });
  expect(state.phase).toBe('idle');

  state = drawReducer(state, { type: 'TAP' });
  expect(state.phase).toBe('tumbling');
  state = drawReducer(state, { type: 'TICK' });
  expect(state.phase).toBe('revealed');
  state = drawReducer(state, { type: 'TICK' });
  expect(state.phase).toBe('landed');

  const rows = landedSides(state);
  expect(rows[0]).toEqual({ landed: true, opponent: rangers, venue: 'H', kickoff: opponentTies[0].kickoff });
  expect(rows[1].landed).toBe(false);
  expect(rows[2].landed).toBe(false);
});

test('opponents mode TAP is ignored mid-animation, same gating as bowl', () => {
  let state = initDraw(opponentTies, 'opponents', { subjectTeamId: celtic.teamId });
  state = drawReducer(state, { type: 'TAP' });
  expect(state.phase).toBe('tumbling');

  const midTumble = drawReducer(state, { type: 'TAP' });
  expect(midTumble).toBe(state);

  state = drawReducer(state, { type: 'TICK' });
  expect(state.phase).toBe('revealed');
  const midReveal = drawReducer(state, { type: 'TAP' });
  expect(midReveal).toBe(state);
});

test('mixed home/away fixtures map venues correctly for every opponent', () => {
  const state = drawReducer(
    initDraw(opponentTies, 'opponents', { subjectTeamId: celtic.teamId }),
    { type: 'REVEAL_REST' },
  );
  const rows = landedSides(state);
  expect(rows.map(r => r.venue)).toEqual(['H', 'A', 'H']); // celtic: home, away, home
  expect(rows.map(r => r.opponent)).toEqual([rangers, aberdeen, hibs]);
  expect(rows.map(r => r.kickoff)).toEqual(opponentTies.map(t => t.kickoff));
});

test('subject club never appears in remainingClubs or landedSides, landed or not', () => {
  let state = initDraw(opponentTies, 'opponents', { subjectTeamId: celtic.teamId });
  expect(remainingClubs(state)).toEqual([rangers, aberdeen, hibs]);
  expect(remainingClubs(state).some(c => c.teamId === celtic.teamId)).toBe(false);
  expect(landedSides(state).some(r => r.opponent.teamId === celtic.teamId)).toBe(false);

  state = drawReducer(state, { type: 'TAP' });
  state = drawReducer(state, { type: 'TICK' });
  state = drawReducer(state, { type: 'TICK' });
  expect(remainingClubs(state)).toEqual([aberdeen, hibs]);
  expect(remainingClubs(state).some(c => c.teamId === celtic.teamId)).toBe(false);
  expect(landedSides(state).some(r => r.opponent.teamId === celtic.teamId)).toBe(false);
});

test('REVEAL_REST lands every opponent at once in opponents mode', () => {
  const state = drawReducer(
    initDraw(opponentTies, 'opponents', { subjectTeamId: celtic.teamId }),
    { type: 'REVEAL_REST' },
  );
  expect(state.phase).toBe('complete');
  expect(isComplete(state)).toBe(true);
  expect(remainingClubs(state)).toHaveLength(0);
  expect(landedSides(state).every(r => r.landed)).toBe(true);
});

test('RESET restores the initial idle state for opponents mode, preserving subjectTeamId', () => {
  let state = initDraw(opponentTies, 'opponents', { subjectTeamId: celtic.teamId });
  state = drawReducer(state, { type: 'TAP' });
  state = drawReducer(state, { type: 'TICK' });
  state = drawReducer(state, { type: 'TICK' });
  state = drawReducer(state, { type: 'RESET' });
  expect(state).toEqual(initDraw(opponentTies, 'opponents', { subjectTeamId: celtic.teamId }));
  expect(state.phase).toBe('idle');
  expect(remainingClubs(state)).toHaveLength(3);
});

// --- REVEAL_REST / RESET ---

test('REVEAL_REST completes the draw from idle, landing every side at once', () => {
  const state = drawReducer(initDraw(bowlTies, 'bowl'), { type: 'REVEAL_REST' });
  expect(state.phase).toBe('complete');
  expect(isComplete(state)).toBe(true);
  expect(remainingClubs(state)).toHaveLength(0);
  expect(landedSides(state).every(s => s.home && s.away)).toBe(true);
});

test('REVEAL_REST completes the draw from mid-animation too', () => {
  let state = initDraw(rollcallTies, 'rollcall');
  state = drawReducer(state, { type: 'TAP' }); // mid-draw on tie 0
  state = drawReducer(state, { type: 'REVEAL_REST' });
  expect(state.phase).toBe('complete');
  expect(landedSides(state).every(s => s.home && s.away)).toBe(true);
});

test('RESET restores the initial idle state, ready to replay', () => {
  let state = initDraw(bowlTies, 'bowl');
  state = drawReducer(state, { type: 'TAP' });
  state = drawReducer(state, { type: 'TICK' });
  state = drawReducer(state, { type: 'TICK' });
  state = drawReducer(state, { type: 'RESET' });
  expect(state).toEqual(initDraw(bowlTies, 'bowl'));
  expect(state.phase).toBe('idle');
  expect(remainingClubs(state)).toHaveLength(6);
});

test('RESET from complete also restores idle', () => {
  const complete = drawReducer(initDraw(rollcallTies, 'rollcall'), { type: 'REVEAL_REST' });
  const reset = drawReducer(complete, { type: 'RESET' });
  expect(reset.phase).toBe('idle');
  expect(isComplete(reset)).toBe(false);
});

// --- TIMINGS export exists and is tunable ---

test('TIMINGS exports the four validated pacing constants', () => {
  expect(TIMINGS).toEqual({ tumble: 1200, holdOpen: 1500, land: 450, rollcallGap: 1100 });
});

// --- seededShuffle: deterministic display shuffle (hotfix — the bowl no
// longer telegraphs the draw order by rendering clubs in tie order) ---

const sixteen = Array.from({ length: 16 }, (_, i) => side(`s${i}`, `Side ${i}`));

test('seededShuffle is deterministic — the same items and seed always produce the same order', () => {
  const a = seededShuffle(sixteen, 'sco.tennents:fourth-round');
  const b = seededShuffle(sixteen, 'sco.tennents:fourth-round');
  expect(a).toEqual(b);
});

test('seededShuffle produces a different order for a different seed', () => {
  const a = seededShuffle(sixteen, 'sco.tennents:fourth-round');
  const b = seededShuffle(sixteen, 'sco.tennents:fifth-round');
  expect(a).not.toEqual(b);
});

test('seededShuffle returns a permutation of the input — same elements, not the original identity order', () => {
  const shuffled = seededShuffle(sixteen, 'sco.tennents:fourth-round');
  expect(shuffled).toHaveLength(sixteen.length);
  expect([...shuffled].sort((a, b) => a.teamId.localeCompare(b.teamId)))
    .toEqual([...sixteen].sort((a, b) => a.teamId.localeCompare(b.teamId)));
  expect(shuffled).not.toEqual(sixteen);
});

test('seededShuffle never mutates the input array', () => {
  const original = sixteen.slice();
  seededShuffle(sixteen, 'sco.tennents:fourth-round');
  expect(sixteen).toEqual(original);
});

// --- scatterShuffle: anti-telegraph guarantee for the roll-call list (fix
// — a plain seededShuffle still coincidentally seats a tie's two clubs
// consecutively often enough, in ~65% of realistic seeds, to read as the
// same "pairings visible before the draw" bug; scatterShuffle re-salts
// deterministically until none are) ---

const scatterClubs = rollcallTies.flatMap(t => [t.home, t.away]);

test('scatterShuffle removes an adjacency the plain shuffle has, for a real seed', () => {
  // sco.tennents:first-round is a real (compId, round) seed that, checked
  // directly, leaves three of rollcallTies' nine pairs consecutive under
  // plain seededShuffle — exactly the bug scatterShuffle exists to fix.
  const plain = seededShuffle(scatterClubs, 'sco.tennents:first-round');
  const plainPairKeys = new Set(rollcallTies.map(t => [t.home.teamId, t.away.teamId].sort().join('|')));
  const plainHasAdjacency = plain.some((club, i) => i < plain.length - 1
    && plainPairKeys.has([club.teamId, plain[i + 1].teamId].sort().join('|')));
  expect(plainHasAdjacency).toBe(true); // the plain shuffle does have the bug for this seed

  const scattered = scatterShuffle(scatterClubs, rollcallTies, 'sco.tennents:first-round');
  const scatteredHasAdjacency = scattered.some((club, i) => i < scattered.length - 1
    && plainPairKeys.has([club.teamId, scattered[i + 1].teamId].sort().join('|')));
  expect(scatteredHasAdjacency).toBe(false); // scatterShuffle clears it
  // Still a permutation of the same clubs, not a different set.
  expect([...scattered].sort((a, b) => a.teamId.localeCompare(b.teamId)))
    .toEqual([...scatterClubs].sort((a, b) => a.teamId.localeCompare(b.teamId)));
});

test('scatterShuffle is deterministic — the same clubs, ties and seed always produce the same order', () => {
  const a = scatterShuffle(scatterClubs, rollcallTies, 'sco.tennents:first-round');
  const b = scatterShuffle(scatterClubs, rollcallTies, 'sco.tennents:first-round');
  expect(a).toEqual(b);
});

test('scatterShuffle terminates for a pathological input with no adjacency-free arrangement, instead of hanging', () => {
  // 2 ties, both between the SAME pair of clubs (a genuine "replay pair" —
  // the same two clubs meeting twice in a round, per remainingClubs'
  // comments) — mathematically unsatisfiable: with only 2 distinct club
  // identities filling 4 slots, at least one A-next-to-B adjacency is
  // unavoidable in any arrangement, so the re-salt cap is always exhausted.
  const alpha = side('alpha', 'Alpha');
  const bravo = side('bravo', 'Bravo');
  const replayTies = [tie('x1', alpha, bravo, '2026-08-01T15:00:00Z'), tie('x2', alpha, bravo, '2026-08-08T15:00:00Z')];
  const replayClubs = [alpha, bravo, alpha, bravo];

  const start = Date.now();
  const result = scatterShuffle(replayClubs, replayTies, 'any-seed');
  expect(Date.now() - start).toBeLessThan(1000); // returns promptly, doesn't hang hunting for the impossible
  expect(result).toHaveLength(4);
  expect([...result].sort((a, b) => a.teamId.localeCompare(b.teamId)))
    .toEqual([...replayClubs].sort((a, b) => a.teamId.localeCompare(b.teamId)));
});
