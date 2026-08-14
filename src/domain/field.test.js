import { roundOrder, entryTiers, survivalState, fallbackRoundLabel } from './field.js';

const side = (teamId, name, score = null, penaltyScore = null) =>
  ({ teamId, name, crestUrl: `${teamId}.png`, monogram: name.slice(0, 2).toUpperCase(), score, penaltyScore });

const fx = (id, round, kickoff, status, home, away) =>
  ({ id, compId: 'sco.tennents', kickoff, status, minute: null, round, venue: null, home, away });

// ---------------------------------------------------------------- roundOrder

test('roundOrder orders by earliest kickoff, not alphabetically or array order', () => {
  // Listed quarterfinals-first with the later kickoff, fourth-round second
  // with the earlier kickoff — a naive "first seen in the array" or
  // alphabetised implementation would get this wrong either way.
  const fixtures = [
    fx('1', 'quarterfinals', '2026-04-01T15:00:00Z', 'scheduled', side('1', 'A'), side('2', 'B')),
    fx('2', 'fourth-round', '2026-02-01T15:00:00Z', 'scheduled', side('3', 'C'), side('4', 'D')),
  ];
  expect(roundOrder(fixtures)).toEqual(['fourth-round', 'quarterfinals']);
});

test('roundOrder excludes null rounds and is null-safe on empty input', () => {
  const fixtures = [
    fx('1', null, '2026-01-01T15:00:00Z', 'scheduled', side('1', 'A'), side('2', 'B')),
    fx('2', 'final', '2026-01-02T15:00:00Z', 'scheduled', side('3', 'C'), side('4', 'D')),
  ];
  expect(roundOrder(fixtures)).toEqual(['final']);
  expect(roundOrder([])).toEqual([]);
  expect(roundOrder(undefined)).toEqual([]);
});

// --------------------------------------------------------------- entryTiers

test('entryTiers groups staggered entries by first-appearance round', () => {
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 2), side('2', 'Bravo', 0)),
    fx('2', 'round-1', '2026-01-01T15:00:00Z', 'ft', side('3', 'Charlie', 3), side('4', 'Delta', 1)),
    // Round 2: Alpha and Charlie advance (already entered round-1); Echo
    // and Foxtrot are new entrants.
    fx('3', 'round-2', '2026-02-01T15:00:00Z', 'scheduled', side('1', 'Alpha'), side('5', 'Echo')),
    fx('4', 'round-2', '2026-02-01T15:00:00Z', 'scheduled', side('3', 'Charlie'), side('6', 'Foxtrot')),
  ];
  const tiers = entryTiers(fixtures);
  expect(tiers).toEqual([
    { round: 'round-1', clubs: [side('1', 'Alpha', 2), side('2', 'Bravo', 0), side('3', 'Charlie', 3), side('4', 'Delta', 1)] },
    { round: 'round-2', clubs: [side('5', 'Echo'), side('6', 'Foxtrot')] },
  ]);
  // Sorted by name within each tier, and each club appears exactly once.
  expect(tiers[0].clubs.map(c => c.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
  expect(tiers[1].clubs.map(c => c.name)).toEqual(['Echo', 'Foxtrot']);
  expect(tiers.flatMap(t => t.clubs).map(c => c.teamId)).toEqual(['1', '2', '3', '4', '5', '6']);
});

test('entryTiers is empty for no fixtures', () => {
  expect(entryTiers([])).toEqual([]);
});

// ------------------------------------------------------------ fallbackRoundLabel

test('fallbackRoundLabel title-cases a raw slug', () => {
  expect(fallbackRoundLabel('group-stage')).toBe('Group Stage');
  expect(fallbackRoundLabel('league-phase')).toBe('League Phase');
  expect(fallbackRoundLabel(null)).toBe('');
  expect(fallbackRoundLabel(undefined)).toBe('');
});

// ------------------------------------------------------------- survivalState

test('empty fixtures yield an empty, champion-less field', () => {
  expect(survivalState([])).toEqual({ in: [], out: [], champion: null });
});

test('basic two-round knockout: round-1 losers out, winners + entrants in', () => {
  const A = side('1', 'Alpha', 2, null), B = side('2', 'Bravo', 1, null);
  const C = side('3', 'Charlie', 0, null), D = side('4', 'Delta', 1, null);
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'ft', A, B), // Alpha wins
    fx('2', 'round-1', '2026-01-01T15:00:00Z', 'ft', C, D), // Delta wins
    fx('3', 'round-2', '2026-02-01T15:00:00Z', 'scheduled', side('1', 'Alpha'), side('4', 'Delta')),
  ];
  const result = survivalState(fixtures);
  expect(result.out).toEqual([{ round: 'round-1', clubs: [
    { teamId: '2', name: 'Bravo', crestUrl: '2.png', monogram: 'BR', score: 1, penaltyScore: null },
    { teamId: '3', name: 'Charlie', crestUrl: '3.png', monogram: 'CH', score: 0, penaltyScore: null },
  ] }]);
  expect(result.in.map(c => c.name)).toEqual(['Alpha', 'Delta']);
  expect(result.champion).toBeNull();
});

test('group stage -> knockout: absentees from the published last-16 are out under group-stage', () => {
  const fixtures = [
    fx('1', 'group-stage', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 2), side('2', 'Bravo', 1)),
    fx('2', 'group-stage', '2026-01-01T15:00:00Z', 'ft', side('3', 'Charlie', 3), side('4', 'Delta', 0)),
    // Only the survivors are paired in the published last-16; Bravo and
    // Delta are absent, even though the last-16 tie hasn't kicked off yet.
    fx('3', 'last-16', '2026-02-01T15:00:00Z', 'scheduled', side('1', 'Alpha'), side('3', 'Charlie')),
  ];
  const result = survivalState(fixtures);
  expect(result.out).toEqual([{ round: 'group-stage', clubs: [
    { teamId: '2', name: 'Bravo', crestUrl: '2.png', monogram: 'BR', score: 1, penaltyScore: null },
    { teamId: '4', name: 'Delta', crestUrl: '4.png', monogram: 'DE', score: 0, penaltyScore: null },
  ] }]);
  expect(result.in.map(c => c.name)).toEqual(['Alpha', 'Charlie']);
});

test('singleLeg: a decided ft tie eliminates its loser immediately, even with no later round', () => {
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 2), side('2', 'Bravo', 1)),
  ];
  const result = survivalState(fixtures, { singleLeg: true });
  expect(result.out).toEqual([{ round: 'round-1', clubs: [
    { teamId: '2', name: 'Bravo', crestUrl: '2.png', monogram: 'BR', score: 1, penaltyScore: null },
  ] }]);
  expect(result.in.map(c => c.name)).toEqual(['Alpha']);
});

test('singleLeg: equal scores broken by a penalty shootout eliminate the shootout loser', () => {
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 3, 4), side('2', 'Bravo', 3, 2)),
  ];
  const result = survivalState(fixtures, { singleLeg: true });
  expect(result.out).toEqual([{ round: 'round-1', clubs: [
    { teamId: '2', name: 'Bravo', crestUrl: '2.png', monogram: 'BR', score: 3, penaltyScore: 2 },
  ] }]);
  expect(result.in.map(c => c.name)).toEqual(['Alpha']);
});

test('singleLeg: an undecidable draw with no shootout data leaves both clubs in', () => {
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 1), side('2', 'Bravo', 1)),
  ];
  const result = survivalState(fixtures, { singleLeg: true });
  expect(result.out).toEqual([]);
  expect(result.in.map(c => c.name)).toEqual(['Alpha', 'Bravo']);
});

test('two-legged safety: with singleLeg false, a lost first leg does not eliminate', () => {
  const fixtures = [
    fx('1', 'quarterfinals', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 1), side('2', 'Bravo', 2)),
    fx('2', 'quarterfinals', '2026-01-08T15:00:00Z', 'scheduled', side('2', 'Bravo'), side('1', 'Alpha')),
  ];
  const result = survivalState(fixtures, { singleLeg: false });
  expect(result.out).toEqual([]);
  expect(result.in.map(c => c.name)).toEqual(['Alpha', 'Bravo']);
});

test('two-legged completeness: once both legs are ft and a later round is published, the aggregate loser is out', () => {
  const fixtures = [
    fx('1', 'quarterfinals', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 1), side('2', 'Bravo', 2)),
    fx('2', 'quarterfinals', '2026-01-08T15:00:00Z', 'ft', side('2', 'Bravo', 0), side('1', 'Alpha', 0)),
    fx('3', 'semifinals', '2026-02-01T15:00:00Z', 'scheduled', side('2', 'Bravo'), side('7', 'Golf')),
  ];
  const result = survivalState(fixtures, { singleLeg: false });
  expect(result.out).toEqual([{ round: 'quarterfinals', clubs: [
    { teamId: '1', name: 'Alpha', crestUrl: '1.png', monogram: 'AL', score: 1, penaltyScore: null },
  ] }]);
  expect(result.in.map(c => c.name)).toEqual(['Bravo', 'Golf']);
});

test('a decided, complete final crowns a champion; the loser is out and the champion is not in `in`', () => {
  const fixtures = [
    fx('1', 'semifinals', '2026-01-01T15:00:00Z', 'ft', side('5', 'Echo', 0), side('1', 'Alpha', 3)),
    fx('2', 'semifinals', '2026-01-01T15:00:00Z', 'ft', side('6', 'Foxtrot', 1), side('2', 'Bravo', 2)),
    fx('3', 'final', '2026-02-01T15:00:00Z', 'ft', side('1', 'Alpha', 2), side('2', 'Bravo', 0)),
  ];
  const result = survivalState(fixtures);
  expect(result.champion).toEqual({ teamId: '1', name: 'Alpha', crestUrl: '1.png', monogram: 'AL', score: 2, penaltyScore: null });
  expect(result.out).toEqual([
    { round: 'semifinals', clubs: [
      { teamId: '5', name: 'Echo', crestUrl: '5.png', monogram: 'EC', score: 0, penaltyScore: null },
      { teamId: '6', name: 'Foxtrot', crestUrl: '6.png', monogram: 'FO', score: 1, penaltyScore: null },
    ] },
    { round: 'final', clubs: [
      { teamId: '2', name: 'Bravo', crestUrl: '2.png', monogram: 'BR', score: 0, penaltyScore: null },
    ] },
  ]);
  expect(result.in).toEqual([]);
  expect(result.in.some(c => c.teamId === '1')).toBe(false);
});

test('incomplete round (one fixture still scheduled): no elimination from that round', () => {
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 2), side('2', 'Bravo', 0)),
    fx('2', 'round-1', '2026-01-01T15:00:00Z', 'scheduled', side('3', 'Charlie'), side('4', 'Delta')),
    fx('3', 'round-2', '2026-02-01T15:00:00Z', 'scheduled', side('1', 'Alpha'), side('5', 'Echo')),
  ];
  const result = survivalState(fixtures);
  expect(result.out).toEqual([]);
  expect(result.in.map(c => c.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
});

test('singleLeg replay safety: a replay overturning the first leg eliminates only the true loser', () => {
  // Alpha beats Bravo 2-1, then a replay in the SAME round has Bravo beat
  // Alpha 3-0 — only the chronologically last decisive meeting counts.
  const fixtures = [
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 2), side('2', 'Bravo', 1)),
    fx('2', 'round-1', '2026-01-08T15:00:00Z', 'ft', side('2', 'Bravo', 3), side('1', 'Alpha', 0)),
  ];
  const result = survivalState(fixtures, { singleLeg: true });
  // The eliminated side object comes from the replay (the decisive
  // meeting that actually counted), not the overturned first leg.
  expect(result.out).toEqual([{ round: 'round-1', clubs: [
    { teamId: '1', name: 'Alpha', crestUrl: '1.png', monogram: 'AL', score: 0, penaltyScore: null },
  ] }]);
  expect(result.in.map(c => c.name)).toEqual(['Bravo']);
});

test('singleLeg replay safety is order-independent: reversing the fixtures array gives the same verdict', () => {
  const fixtures = [
    fx('2', 'round-1', '2026-01-08T15:00:00Z', 'ft', side('2', 'Bravo', 3), side('1', 'Alpha', 0)),
    fx('1', 'round-1', '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 2), side('2', 'Bravo', 1)),
  ];
  const result = survivalState(fixtures, { singleLeg: true });
  expect(result.out).toEqual([{ round: 'round-1', clubs: [
    { teamId: '1', name: 'Alpha', crestUrl: '1.png', monogram: 'AL', score: 0, penaltyScore: null },
  ] }]);
  expect(result.in.map(c => c.name)).toEqual(['Bravo']);
});

test('residual behaviour: fixtures with round null are invisible to survival — those clubs stay in', () => {
  // The accepted conservative default: a fixture that never resolved to a
  // round slug (e.g. an unrecognised BBC secondaryGroup label) cannot
  // enter roundOrder/lastRoundIdx, so its clubs are never candidates for
  // elimination even when their meeting finished decisively.
  const fixtures = [
    fx('1', null, '2026-01-01T15:00:00Z', 'ft', side('1', 'Alpha', 2), side('2', 'Bravo', 0)),
    fx('2', 'round-1', '2026-01-05T15:00:00Z', 'ft', side('3', 'Charlie', 1), side('4', 'Delta', 0)),
    fx('3', 'round-2', '2026-02-01T15:00:00Z', 'scheduled', side('3', 'Charlie'), side('5', 'Echo')),
  ];
  const result = survivalState(fixtures);
  expect(result.out).toEqual([{ round: 'round-1', clubs: [
    { teamId: '4', name: 'Delta', crestUrl: '4.png', monogram: 'DE', score: 0, penaltyScore: null },
  ] }]);
  // Echo stays in too (round-2 is the last published round, so rule 2
  // doesn't touch it) — the only exclusion under test here is Alpha/Bravo.
  expect(result.in.map(c => c.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Echo']);
});
