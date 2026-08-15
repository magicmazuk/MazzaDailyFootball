import { tieId, unrevealedDraws, allTieIds } from './draws.js';

const cupComp = id => ({ id, type: 'cup', name: id });
const leagueComp = id => ({ id, type: 'league', name: id });

const side = (teamId, name) => ({ teamId, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase() });

const fx = (id, compId, round, kickoff, status = 'scheduled') =>
  ({ id, compId, kickoff, status, minute: null, round, venue: null,
    home: side(`${id}h`, 'Home'), away: side(`${id}a`, 'Away') });

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
