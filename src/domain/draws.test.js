import {
  tieId, unrevealedDraws, allTieIds, unrevealedPhaseDraws, phaseTieIds,
  dedupePairings, roundTieIds,
} from './draws.js';

const cupComp = id => ({ id, type: 'cup', name: id });
const leagueComp = id => ({ id, type: 'league', name: id });

const side = (teamId, name) => ({ teamId, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase() });

const fx = (id, compId, round, kickoff, status = 'scheduled') =>
  ({ id, compId, kickoff, status, minute: null, round, venue: null,
    home: side(`${id}h`, 'Home'), away: side(`${id}a`, 'Away') });

// A phase (group-stage/league-phase) fixture with explicit home/away sides
// — unrevealedPhaseDraws is club-centric, so tests need control over which
// specific club appears in which fixture.
const phaseFx = (id, compId, round, kickoff, home, away, status = 'scheduled') =>
  ({ id, compId, kickoff, status, minute: null, round, venue: null, home, away });

// -------------------------------------------------------------------- tieId

test('tieId joins compId and fixtureId with a colon', () => {
  expect(tieId('sco.tennents', '123')).toBe('sco.tennents:123');
});

// ----------------------------------------------------------- unrevealedDraws

test('a qualifying round (all scheduled, all unseen, labelled, 2+ ties) is detected', () => {
  const comp = cupComp('sco.tennents');
  const fixtures = [
    fx('1', comp.id, 'fourth-round', '2026-02-01T15:00:00Z'),
    fx('2', comp.id, 'fourth-round', '2026-02-01T12:00:00Z'),
  ];
  const result = unrevealedDraws([{ comp, fixtures }], {});
  expect(result).toHaveLength(1);
  expect(result[0].comp).toBe(comp);
  expect(result[0].round).toBe('fourth-round');
  expect(result[0].roundLabel).toBe('Fourth round');
  // sorted by kickoff, not array order
  expect(result[0].ties.map(f => f.id)).toEqual(['2', '1']);
});

test('unrevealedDraws gains tieCount = dedupePairings(fixtures).length, distinct from ties (the full fixture list, both legs)', () => {
  const comp = cupComp('uefa.champions');
  const pairs = Array.from({ length: 7 }, (_, i) => ({
    home: side(`h${i}`, `Home ${i}`),
    away: side(`a${i}`, `Away ${i}`),
  }));
  const fixtures = pairs.flatMap((p, i) => [
    phaseFx(`leg1-${i}`, comp.id, 'playoff-round', `2026-02-0${i + 1}T15:00:00Z`, p.home, p.away),
    phaseFx(`leg2-${i}`, comp.id, 'playoff-round', `2026-02-2${i + 1}T15:00:00Z`, p.away, p.home),
  ]);
  const result = unrevealedDraws([{ comp, fixtures }], {});
  expect(result).toHaveLength(1);
  expect(result[0].ties).toHaveLength(14); // full fixture list — hiding/seen-marking depend on it
  expect(result[0].tieCount).toBe(7); // deduped pairing count — what the invitation card shows
});

test('a partially-seen round is not detected (idempotence after reveal)', () => {
  const comp = cupComp('sco.tennents');
  const fixtures = [
    fx('1', comp.id, 'fourth-round', '2026-02-01T15:00:00Z'),
    fx('2', comp.id, 'fourth-round', '2026-02-01T12:00:00Z'),
  ];
  const seenTies = { [tieId(comp.id, '1')]: true };
  expect(unrevealedDraws([{ comp, fixtures }], seenTies)).toEqual([]);
});

test('a round with any live or ft fixture is not detected', () => {
  const comp = cupComp('sco.tennents');
  const fixtures = [
    fx('1', comp.id, 'fourth-round', '2026-02-01T15:00:00Z', 'live'),
    fx('2', comp.id, 'fourth-round', '2026-02-01T12:00:00Z', 'scheduled'),
  ];
  expect(unrevealedDraws([{ comp, fixtures }], {})).toEqual([]);
});

test('a single-tie round is not detected (broadcast scheduling, not a draw)', () => {
  const comp = cupComp('sco.tennents');
  const fixtures = [fx('1', comp.id, 'final', '2026-05-01T15:00:00Z')];
  expect(unrevealedDraws([{ comp, fixtures }], {})).toEqual([]);
});

test('league competitions are ignored even with qualifying-shaped rounds', () => {
  const comp = leagueComp('sco.1');
  const fixtures = [
    fx('1', comp.id, 'round-1', '2026-02-01T15:00:00Z'),
    fx('2', comp.id, 'round-1', '2026-02-01T12:00:00Z'),
  ];
  expect(unrevealedDraws([{ comp, fixtures }], {})).toEqual([]);
});

test('label-less rounds are ignored (year-prefixed slug: neither prettifyRound nor fallbackRoundLabel produce a label)', () => {
  const comp = cupComp('sco.1');
  const fixtures = [
    fx('1', comp.id, '2026-27-scottish-premiership', '2026-02-01T15:00:00Z'),
    fx('2', comp.id, '2026-27-scottish-premiership', '2026-02-01T12:00:00Z'),
  ];
  expect(unrevealedDraws([{ comp, fixtures }], {})).toEqual([]);
});

test('multiple comps qualify simultaneously, returned in fixturesByComp order (comp registry order)', () => {
  const compA = cupComp('sco.tennents');
  const compB = cupComp('eng.fa');
  const fixturesA = [
    fx('1', compA.id, 'fourth-round', '2026-02-01T15:00:00Z'),
    fx('2', compA.id, 'fourth-round', '2026-02-01T12:00:00Z'),
  ];
  const fixturesB = [
    fx('3', compB.id, 'third-round', '2026-01-05T15:00:00Z'),
    fx('4', compB.id, 'third-round', '2026-01-05T12:00:00Z'),
  ];
  const result = unrevealedDraws(
    [{ comp: compA, fixtures: fixturesA }, { comp: compB, fixtures: fixturesB }],
    {},
  );
  expect(result.map(r => r.comp.id)).toEqual(['sco.tennents', 'eng.fa']);
});

test('a group-stage round never qualifies as a draw, even fully scheduled and unseen; a knockout round alongside it still does', () => {
  const comp = cupComp('sco.cis');
  const groupFixtures = Array.from({ length: 6 }, (_, i) =>
    fx(`g${i}`, comp.id, 'group-stage', `2026-08-0${i + 1}T15:00:00Z`));
  const knockoutFixtures = [
    fx('k1', comp.id, 'fourth-round', '2026-09-01T15:00:00Z'),
    fx('k2', comp.id, 'fourth-round', '2026-09-01T12:00:00Z'),
  ];
  const result = unrevealedDraws(
    [{ comp, fixtures: [...groupFixtures, ...knockoutFixtures] }],
    {},
  );
  expect(result).toHaveLength(1);
  expect(result[0].round).toBe('fourth-round');
});

test('a league-phase round never qualifies as a draw', () => {
  const comp = cupComp('sco.challenge');
  const fixtures = [
    fx('1', comp.id, 'league-phase', '2026-08-01T15:00:00Z'),
    fx('2', comp.id, 'league-phase', '2026-08-01T12:00:00Z'),
  ];
  expect(unrevealedDraws([{ comp, fixtures }], {})).toEqual([]);
});

// --------------------------------------------------------------- allTieIds

test('allTieIds returns every cup fixture tieId, ignoring league comps', () => {
  const compCup = cupComp('sco.tennents');
  const compLeague = leagueComp('sco.1');
  const fixturesByComp = [
    { comp: compCup, fixtures: [
      fx('1', compCup.id, 'fourth-round', '2026-02-01T15:00:00Z'),
      fx('2', compCup.id, 'fourth-round', '2026-02-01T12:00:00Z'),
    ] },
    { comp: compLeague, fixtures: [
      fx('3', compLeague.id, 'round-1', '2026-02-01T15:00:00Z'),
    ] },
  ];
  expect(allTieIds(fixturesByComp)).toEqual([
    tieId('sco.tennents', '1'),
    tieId('sco.tennents', '2'),
  ]);
});

// ------------------------------------------------------- unrevealedPhaseDraws

test('a followed club with 8 scheduled unseen phase fixtures is detected, fixtures listed in kickoff order', () => {
  const comp = cupComp('eng.champions');
  const celtic = side('c1', 'Celtic');
  const fixtures = Array.from({ length: 8 }, (_, i) => (i % 2 === 0
    ? phaseFx(`f${i}`, comp.id, 'league-phase', `2026-09-0${i + 1}T15:00:00Z`, celtic, side(`o${i}`, `Opponent ${i}`))
    : phaseFx(`f${i}`, comp.id, 'league-phase', `2026-09-0${i + 1}T15:00:00Z`, side(`o${i}`, `Opponent ${i}`), celtic)));

  const result = unrevealedPhaseDraws([{ comp, fixtures }], {}, [celtic.teamId]);
  expect(result).toHaveLength(1);
  expect(result[0].comp).toBe(comp);
  expect(result[0].round).toBe('league-phase');
  expect(result[0].roundLabel).toBe('League Phase');
  expect(result[0].club.teamId).toBe(celtic.teamId);
  // venue-agnostic: fixtures returned regardless of home/away, in kickoff order
  expect(result[0].fixtures.map(f => f.id)).toEqual(fixtures.map(f => f.id));
});

test('an unfollowed club\'s phase fixtures are ignored, even fully qualifying', () => {
  const comp = cupComp('eng.champions');
  const celtic = side('c1', 'Celtic');
  const rangers = side('c2', 'Rangers'); // followed, but never appears in a fixture
  const fixtures = [
    phaseFx('f1', comp.id, 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    phaseFx('f2', comp.id, 'league-phase', '2026-09-02T15:00:00Z', celtic, side('o2', 'Opponent 2')),
  ];
  expect(unrevealedPhaseDraws([{ comp, fixtures }], {}, [rangers.teamId])).toEqual([]);
});

test('a phase round with one seen fixture for the club is not detected', () => {
  const comp = cupComp('eng.champions');
  const celtic = side('c1', 'Celtic');
  const fixtures = [
    phaseFx('f1', comp.id, 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    phaseFx('f2', comp.id, 'league-phase', '2026-09-02T15:00:00Z', celtic, side('o2', 'Opponent 2')),
  ];
  const seenTies = { [tieId(comp.id, 'f1')]: true };
  expect(unrevealedPhaseDraws([{ comp, fixtures }], seenTies, [celtic.teamId])).toEqual([]);
});

test('a phase round with one already-played fixture for the club is not detected', () => {
  const comp = cupComp('eng.champions');
  const celtic = side('c1', 'Celtic');
  const fixtures = [
    phaseFx('f1', comp.id, 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1'), 'ft'),
    phaseFx('f2', comp.id, 'league-phase', '2026-09-02T15:00:00Z', celtic, side('o2', 'Opponent 2')),
  ];
  expect(unrevealedPhaseDraws([{ comp, fixtures }], {}, [celtic.teamId])).toEqual([]);
});

test('a club with only one phase fixture is not detected', () => {
  const comp = cupComp('eng.champions');
  const celtic = side('c1', 'Celtic');
  const fixtures = [
    phaseFx('f1', comp.id, 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
  ];
  expect(unrevealedPhaseDraws([{ comp, fixtures }], {}, [celtic.teamId])).toEqual([]);
});

test('knockout-round fixtures for a followed club are never returned by this function', () => {
  const comp = cupComp('eng.champions');
  const celtic = side('c1', 'Celtic');
  const fixtures = [
    phaseFx('f1', comp.id, 'round-of-16', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    phaseFx('f2', comp.id, 'round-of-16', '2026-09-02T15:00:00Z', celtic, side('o2', 'Opponent 2')),
  ];
  expect(unrevealedPhaseDraws([{ comp, fixtures }], {}, [celtic.teamId])).toEqual([]);
});

test('two followed clubs with qualifying phase fixtures in the same comp yield two entries, ordered by club name', () => {
  const comp = cupComp('eng.champions');
  const celtic = side('c1', 'Celtic');
  const rangers = side('c2', 'Rangers');
  const fixtures = [
    phaseFx('f1', comp.id, 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    phaseFx('f2', comp.id, 'league-phase', '2026-09-02T15:00:00Z', celtic, side('o2', 'Opponent 2')),
    phaseFx('f3', comp.id, 'league-phase', '2026-09-03T15:00:00Z', rangers, side('o3', 'Opponent 3')),
    phaseFx('f4', comp.id, 'league-phase', '2026-09-04T15:00:00Z', rangers, side('o4', 'Opponent 4')),
  ];
  const result = unrevealedPhaseDraws([{ comp, fixtures }], {}, [celtic.teamId, rangers.teamId]);
  expect(result).toHaveLength(2);
  expect(result.map(r => r.club.name)).toEqual(['Celtic', 'Rangers']);
  expect(result[0].fixtures.map(f => f.id)).toEqual(['f1', 'f2']);
  expect(result[1].fixtures.map(f => f.id)).toEqual(['f3', 'f4']);
});

test('a group-stage round resolves to the "Group Stage" label via fallbackRoundLabel', () => {
  const comp = cupComp('sco.cis');
  const celtic = side('c1', 'Celtic');
  const fixtures = [
    phaseFx('f1', comp.id, 'group-stage', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    phaseFx('f2', comp.id, 'group-stage', '2026-08-02T15:00:00Z', celtic, side('o2', 'Opponent 2')),
  ];
  const result = unrevealedPhaseDraws([{ comp, fixtures }], {}, [celtic.teamId]);
  expect(result).toHaveLength(1);
  expect(result[0].roundLabel).toBe('Group Stage');
});

test('entries are ordered by fixturesByComp order (comp registry order) across comps, club name within a comp', () => {
  const compA = cupComp('sco.tennents');
  const compB = cupComp('eng.champions');
  const celtic = side('c1', 'Celtic');
  const rangers = side('c2', 'Rangers');
  const fixturesA = [
    phaseFx('a1', compA.id, 'group-stage', '2026-09-01T15:00:00Z', rangers, side('o1', 'Opponent 1')),
    phaseFx('a2', compA.id, 'group-stage', '2026-09-02T15:00:00Z', rangers, side('o2', 'Opponent 2')),
  ];
  const fixturesB = [
    phaseFx('b1', compB.id, 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o3', 'Opponent 3')),
    phaseFx('b2', compB.id, 'league-phase', '2026-09-02T15:00:00Z', celtic, side('o4', 'Opponent 4')),
  ];
  const result = unrevealedPhaseDraws(
    [{ comp: compA, fixtures: fixturesA }, { comp: compB, fixtures: fixturesB }],
    {}, [celtic.teamId, rangers.teamId],
  );
  expect(result.map(r => r.comp.id)).toEqual(['sco.tennents', 'eng.champions']);
});

// ----------------------------------------------------------- dedupePairings

test('a two-legged round (14 fixtures, 7 pairings) collapses to 7 representatives, the earliest (first) leg of each', () => {
  const comp = cupComp('uefa.champions');
  const pairs = Array.from({ length: 7 }, (_, i) => ({
    home: side(`h${i}`, `Home ${i}`),
    away: side(`a${i}`, `Away ${i}`),
  }));
  const fixtures = pairs.flatMap((p, i) => [
    phaseFx(`leg1-${i}`, comp.id, 'playoff-round', `2026-02-0${i + 1}T15:00:00Z`, p.home, p.away),
    // second leg: reversed venue, later kickoff — same unordered pair
    phaseFx(`leg2-${i}`, comp.id, 'playoff-round', `2026-02-2${i + 1}T15:00:00Z`, p.away, p.home),
  ]);
  const result = dedupePairings(fixtures);
  expect(result).toHaveLength(7);
  // every representative is its pair's first leg (earliest kickoff)
  expect(result.map(f => f.id)).toEqual(pairs.map((_, i) => `leg1-${i}`));
  // representative order is by kickoff (stable), not input order
  expect(result.map(f => f.kickoff)).toEqual([...result.map(f => f.kickoff)].sort());
});

test('dedupePairings is a no-op for single-leg rounds', () => {
  const comp = cupComp('sco.tennents');
  const fixtures = [
    fx('1', comp.id, 'fourth-round', '2026-02-01T15:00:00Z'),
    fx('2', comp.id, 'fourth-round', '2026-02-01T12:00:00Z'),
  ];
  const result = dedupePairings(fixtures);
  // no-op: same fixtures back out, kickoff-ordered
  expect(result.map(f => f.id)).toEqual(['2', '1']);
});

test('dedupePairings collapses a replay to the original tie — a replay is a second decisive meeting for the same drawn pairing, so collapsing it to the first meeting is correct for the draw ceremony, which only ever drew the pairing once', () => {
  const comp = cupComp('sco.tennents');
  const celtic = side('c1', 'Celtic');
  const rangers = side('c2', 'Rangers');
  const original = phaseFx('orig', comp.id, 'fourth-round', '2026-02-01T15:00:00Z', celtic, rangers);
  const replay = phaseFx('replay', comp.id, 'fourth-round', '2026-02-08T15:00:00Z', rangers, celtic);
  expect(dedupePairings([original, replay])).toEqual([original]);
});

test('dedupePairings falls back to normalized names when a side has no teamId', () => {
  const comp = cupComp('sco.tennents');
  const noId = name => ({ teamId: null, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase() });
  const leg1 = phaseFx('leg1', comp.id, 'first-round', '2026-08-01T15:00:00Z', noId('Spartans'), noId('Vale'));
  const leg2 = phaseFx('leg2', comp.id, 'first-round', '2026-08-08T15:00:00Z', noId('Vale'), noId('Spartans'));
  expect(dedupePairings([leg1, leg2])).toEqual([leg1]);
});

test('dedupePairings never mutates its input and returns [] for an empty/nullish list', () => {
  const fixtures = [fx('1', 'sco.tennents', 'fourth-round', '2026-02-01T15:00:00Z')];
  const original = fixtures.slice();
  dedupePairings(fixtures);
  expect(fixtures).toEqual(original);
  expect(dedupePairings(undefined)).toEqual([]);
  expect(dedupePairings([])).toEqual([]);
});

// ------------------------------------------------------------- roundTieIds

test('roundTieIds returns a tieId for every fixture given, both legs of a two-legged round included', () => {
  const comp = cupComp('uefa.champions');
  const fixtures = [
    fx('leg1-0', comp.id, 'playoff-round', '2026-02-01T15:00:00Z'),
    fx('leg2-0', comp.id, 'playoff-round', '2026-02-21T15:00:00Z'),
  ];
  expect(roundTieIds(comp.id, fixtures)).toEqual([
    tieId(comp.id, 'leg1-0'),
    tieId(comp.id, 'leg2-0'),
  ]);
});

test('unrevealedPhaseDraws safety-dedupes a club\'s phase fixtures too (harmless — a real league/group phase never repeats an opponent, but a duplicated fixture must never double-count or double-render)', () => {
  const comp = cupComp('eng.champions');
  const celtic = side('c1', 'Celtic');
  const rangers = side('c2', 'Rangers');
  const fixtures = [
    phaseFx('f1', comp.id, 'league-phase', '2026-09-01T15:00:00Z', celtic, rangers),
    // duplicate of the same pairing, as if the feed republished it
    phaseFx('f1-dup', comp.id, 'league-phase', '2026-09-01T15:05:00Z', rangers, celtic),
  ];
  // Only 1 distinct opponent for celtic once deduped — below the 2+ threshold,
  // so this must NOT qualify, same as a genuine single-fixture round wouldn't.
  expect(unrevealedPhaseDraws([{ comp, fixtures }], {}, [celtic.teamId])).toEqual([]);
});

// -------------------------------------------------------------- phaseTieIds

test('phaseTieIds returns tieIds for the given comp+fixtures, reusing tieId', () => {
  const comp = cupComp('eng.champions');
  const celtic = side('c1', 'Celtic');
  const fixtures = [
    phaseFx('f1', comp.id, 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    phaseFx('f2', comp.id, 'league-phase', '2026-09-02T15:00:00Z', celtic, side('o2', 'Opponent 2')),
  ];
  expect(phaseTieIds(comp, fixtures)).toEqual([tieId(comp.id, 'f1'), tieId(comp.id, 'f2')]);
});
