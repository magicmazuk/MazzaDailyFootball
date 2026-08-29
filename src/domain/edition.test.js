import { expect, test } from 'vitest';
import {
  editionState, movement, stakesLine, todaysCard, tonightsAirtime,
} from './edition.js';

// --- the Saturday card (2026-08-30 is the spec's own example day: BST,
// so 17:00 London = 16:00Z) -------------------------------------------------

const sat = t => `2026-08-30T${t}:00+01:00`;
const fx = (id, kickoff, status) => ({
  id, kickoff, status,
  home: { teamId: `h${id}`, name: `Home ${id}` },
  away: { teamId: `a${id}`, name: `Away ${id}` },
});

const scoFt1 = fx('s1', sat('15:00'), 'ft');
const scoFt2 = fx('s2', sat('15:00'), 'ft');
const scoPost = fx('s3', sat('15:00'), 'postponed');
const scoSched = fx('s4', sat('19:45'), 'scheduled');
const engFt = fx('e1', sat('12:30'), 'ft');
const engLive = fx('e2', sat('17:30'), 'live');
const friFt = fx('f1', '2026-08-29T20:00:00+01:00', 'ft'); // yesterday — never today's card

const sco = { id: 'sco.1', name: 'Scottish Premiership' };
const eng = { id: 'eng.1', name: 'English Premier League' };
const sco2 = { id: 'sco.2', name: 'Scottish Championship' };

const board = [
  { comp: sco, fixtures: [scoFt1, scoFt2, scoPost, scoSched, friFt] },
  { comp: eng, fixtures: [engFt, engLive] },
];

const FIVE_PM_BST = '2026-08-30T16:00:00Z'; // 17:00 London

// --- todaysCard -------------------------------------------------------------

test('todaysCard keeps only fixtures kicking off on now’s London day', () => {
  const lateSunday = fx('x1', '2026-08-30T23:30:00Z', 'scheduled'); // 00:30 BST on the 31st
  expect(todaysCard([scoFt1, friFt, lateSunday, engFt], FIVE_PM_BST)).toEqual([scoFt1, engFt]);
});

test('todaysCard accepts a Date for now and tolerates nulls throughout', () => {
  expect(todaysCard([scoFt1], new Date(FIVE_PM_BST))).toEqual([scoFt1]);
  expect(todaysCard(null, FIVE_PM_BST)).toEqual([]);
  expect(todaysCard(undefined, FIVE_PM_BST)).toEqual([]);
  expect(todaysCard([scoFt1], 'not a date')).toEqual([]);
  expect(todaysCard([scoFt1], null)).toEqual([]);
  expect(todaysCard([null, { ...scoFt1, kickoff: null }], FIVE_PM_BST)).toEqual([]);
});

// --- editionState: the 17:00 London boundary, exact ------------------------

test('editionState: 16:59 London is no edition; 17:00 exactly is (BST instants)', () => {
  expect(editionState(board, '2026-08-30T15:59:00Z')).toBeNull(); // 16:59 BST
  expect(editionState(board, FIVE_PM_BST)).not.toBeNull(); // 17:00 BST on the nose
});

test('editionState: the boundary holds in winter too (GMT, 17:00Z)', () => {
  const dec = [
    { comp: sco, fixtures: ['d1', 'd2', 'd3'].map(id => fx(id, '2026-12-19T15:00:00Z', 'ft')) },
  ];
  expect(editionState(dec, '2026-12-19T16:59:59Z')).toBeNull();
  expect(editionState(dec, '2026-12-19T17:00:00Z')).not.toBeNull();
});

// --- editionState: the 3-FT threshold, across all comps --------------------

test('editionState: two FT today is no edition; the third — from another comp — settles it', () => {
  const twoFt = [
    { comp: sco, fixtures: [scoFt1, scoFt2, scoPost, scoSched] },
    { comp: eng, fixtures: [engLive] },
  ];
  expect(editionState(twoFt, FIVE_PM_BST)).toBeNull();
  const threeFt = [
    { comp: sco, fixtures: [scoFt1, scoFt2] },
    { comp: eng, fixtures: [engFt] },
  ];
  expect(editionState(threeFt, FIVE_PM_BST)).not.toBeNull();
});

test('editionState: yesterday’s full-times never count toward the threshold', () => {
  const padded = [{ comp: sco, fixtures: [scoFt1, scoFt2, friFt, fx('f2', '2026-08-29T15:00:00+01:00', 'ft')] }];
  expect(editionState(padded, FIVE_PM_BST)).toBeNull();
});

test('editionState: live and postponed fixtures never count toward the threshold', () => {
  const noisy = [{ comp: sco, fixtures: [scoFt1, scoFt2, engLive, scoPost] }];
  expect(editionState(noisy, FIVE_PM_BST)).toBeNull();
});

// --- editionState: composition ---------------------------------------------

test('editionState groups results per comp in the given (registry) order, FT only; live is stop-press, postponed its own line', () => {
  const ed = editionState(board, FIVE_PM_BST);
  expect(ed).toEqual({
    results: [
      { comp: sco, fixtures: [scoFt1, scoFt2] },
      { comp: eng, fixtures: [engFt] },
    ],
    inPlay: [engLive],
    postponed: [scoPost],
  });
});

test('editionState omits comps with no FT today from results', () => {
  const withIdle = [...board, { comp: sco2, fixtures: [fx('c1', sat('19:00'), 'scheduled')] }];
  const ed = editionState(withIdle, FIVE_PM_BST);
  expect(ed.results.map(r => r.comp.id)).toEqual(['sco.1', 'eng.1']);
});

test('editionState: a live fixture is never printed among the results', () => {
  const ed = editionState(board, FIVE_PM_BST);
  const printed = ed.results.flatMap(r => r.fixtures);
  expect(printed).not.toContain(engLive);
  expect(printed.every(f => f.status === 'ft')).toBe(true);
});

test('editionState is null-tolerant: null board, null entries, null fixture lists, garbage now', () => {
  expect(editionState(null, FIVE_PM_BST)).toBeNull();
  expect(editionState(undefined, FIVE_PM_BST)).toBeNull();
  expect(editionState([{ comp: sco, fixtures: null }, null], FIVE_PM_BST)).toBeNull();
  expect(editionState(board, 'not a date')).toBeNull();
  expect(editionState(board, null)).toBeNull();
  const mixed = [null, { comp: sco, fixtures: [scoFt1, scoFt2] }, { comp: eng, fixtures: [engFt] }];
  expect(editionState(mixed, FIVE_PM_BST)).toEqual({
    results: [
      { comp: sco, fixtures: [scoFt1, scoFt2] },
      { comp: eng, fixtures: [engFt] },
    ],
    inPlay: [],
    postponed: [],
  });
});

// --- movement: a small synthetic season ------------------------------------

// Four rounds of history, then today's two results. Before today:
// Aird 6pts (+3), Cults 3 (0), Dyce 1 (−1), Brora 1 (−2) → A 1st, C 2nd,
// D 3rd, B 4th. Today Brora win 3–0 and newcomer Elgin beat Dyce, so after:
// A 1st, B 2nd, E 3rd, C 4th, D 5th.
const T = {
  A: { teamId: '1', name: 'Aird' },
  B: { teamId: '2', name: 'Brora' },
  C: { teamId: '3', name: 'Cults' },
  D: { teamId: '4', name: 'Dyce' },
  E: { teamId: '5', name: 'Elgin' },
};
const result = (id, home, hs, away, as) => ({
  id, status: 'ft', kickoff: sat('15:00'),
  home: { ...home, score: hs }, away: { ...away, score: as },
});
const earlier = [
  result('r1', T.A, 2, T.B, 0),
  result('r2', T.C, 1, T.D, 0),
  result('r3', T.A, 1, T.C, 0),
  result('r4', T.D, 0, T.B, 0),
];
const todayResults = [
  result('t1', T.B, 3, T.C, 0),
  result('t2', T.E, 1, T.D, 0),
];
const season = [...earlier, ...todayResults];

test('movement: a climb, a fall, a hold for the idle side, and null for today’s debutant', () => {
  const deltas = movement(season, todayResults);
  expect(deltas.get('2')).toBe(2); // Brora 4th → 2nd: climbed two
  expect(deltas.get('3')).toBe(-2); // Cults 2nd → 4th: fell two
  expect(deltas.get('4')).toBe(-2); // Dyce 3rd → 5th
  expect(deltas.get('1')).toBe(0); // Aird held top without playing
  expect(deltas.get('5')).toBeNull(); // Elgin first appeared today — no before-position
  expect(deltas.size).toBe(5);
});

test('movement: empty or null today means an empty Map — no movement to speak of', () => {
  expect(movement(season, []).size).toBe(0);
  expect(movement(season, null).size).toBe(0);
  expect(movement(null, null).size).toBe(0);
  expect(movement(null, todayResults).size).toBe(0);
});

// --- stakesLine: the capped copy set, verbatim ------------------------------

const row = (teamId, name, points, played, position, shortName) =>
  ({ teamId, name, shortName, points, played, position });

test('stakesLine: top by N', () => {
  const rows = [row('256', 'Celtic', 74, 30, 1), row('257', 'Rangers', 69, 30, 2)];
  expect(stakesLine(rows, ['256'])).toBe('Celtic top by 5.');
});

test('stakesLine: top level on points → goal difference, naming second', () => {
  const rows = [row('256', 'Celtic', 70, 30, 1), row('257', 'Rangers', 70, 30, 2)];
  expect(stakesLine(rows, ['256'])).toBe('Celtic top on goal difference from Rangers.');
});

test('stakesLine: not first → ordinal, points behind, naming the leader', () => {
  const rows = [row('257', 'Rangers', 75, 30, 1), row('256', 'Celtic', 72, 30, 2)];
  expect(stakesLine(rows, ['256'])).toBe('Celtic 2nd, 3 behind Rangers.');
});

test('stakesLine: a game in hand appends — exactly one game, exactly this phrase', () => {
  const rows = [row('257', 'Rangers', 75, 30, 1), row('256', 'Celtic', 72, 29, 2)];
  expect(stakesLine(rows, ['256'])).toBe('Celtic 2nd, 3 behind Rangers, with a game in hand.');
});

test('stakesLine: two or more games in hand counts them', () => {
  const rows = [row('257', 'Rangers', 75, 30, 1), row('256', 'Celtic', 72, 28, 2)];
  expect(stakesLine(rows, ['256'])).toBe('Celtic 2nd, 3 behind Rangers, with 2 games in hand.');
});

test('stakesLine: not first but level on points says so — never "0 behind" (review fix)', () => {
  const rows = [row('257', 'Rangers', 72, 30, 1), row('256', 'Celtic', 72, 30, 2)];
  expect(stakesLine(rows, ['256'])).toBe('Celtic 2nd, level on points with Rangers.');
});

test('stakesLine: the level-on-points base composes with the in-hand suffix like any other', () => {
  const rows = [row('257', 'Rangers', 72, 30, 1), row('256', 'Celtic', 72, 29, 2)];
  expect(stakesLine(rows, ['256'])).toBe('Celtic 2nd, level on points with Rangers, with a game in hand.');
});

test('stakesLine: ordinals print the classified way — 3rd, 12th, 21st', () => {
  const leader = row('999', 'Arsenal', 63, 26, 1);
  expect(stakesLine([leader, row('380', 'Wolves', 33, 26, 21)], ['380']))
    .toBe('Wolves 21st, 30 behind Arsenal.');
  expect(stakesLine([leader, row('381', 'Fulham', 30, 26, 12)], ['381']))
    .toBe('Fulham 12th, 33 behind Arsenal.');
  expect(stakesLine([leader, row('382', 'Everton', 51, 26, 3)], ['382']))
    .toBe('Everton 3rd, 12 behind Arsenal.');
});

test('stakesLine: the first followed club IN THE ROWS speaks — the best-placed, favourites prioritised over the rest of the table', () => {
  const rows = [
    row('257', 'Rangers', 75, 30, 1),
    row('375', 'Hearts', 70, 30, 2),
    row('256', 'Celtic', 68, 30, 3),
  ];
  expect(stakesLine(rows, ['256', '375'])).toBe('Hearts 2nd, 5 behind Rangers.');
});

test('stakesLine: shortName preferred over name, for the club and the leader alike', () => {
  const rows = [
    row('257', 'Rangers FC', 75, 30, 1, 'Rangers'),
    row('256', 'Celtic FC', 72, 30, 2, 'Celtic'),
  ];
  expect(stakesLine(rows, ['256'])).toBe('Celtic 2nd, 3 behind Rangers.');
  const top = [row('256', 'Celtic FC', 74, 30, 1, 'Celtic'), row('257', 'Rangers FC', 69, 30, 2, 'Rangers')];
  expect(stakesLine(top, ['256'])).toBe('Celtic top by 5.');
});

test('stakesLine: null when no followed club is in the rows, or rows are empty/null', () => {
  const rows = [row('257', 'Rangers', 75, 30, 1), row('258', 'Aberdeen', 60, 30, 2)];
  expect(stakesLine(rows, ['256'])).toBeNull();
  expect(stakesLine(rows, [])).toBeNull();
  expect(stakesLine(rows, null)).toBeNull();
  expect(stakesLine([], ['256'])).toBeNull();
  expect(stakesLine(null, ['256'])).toBeNull();
  expect(stakesLine(undefined, ['256'])).toBeNull();
});

test('stakesLine: a one-row table has nobody to subtract against — null, never a guess', () => {
  expect(stakesLine([row('256', 'Celtic', 74, 30, 1)], ['256'])).toBeNull();
});

test('stakesLine: missing points anywhere the arithmetic needs them → null, never NaN copy', () => {
  const noPts = [row('256', 'Celtic', undefined, 30, 1), row('257', 'Rangers', 69, 30, 2)];
  expect(stakesLine(noPts, ['256'])).toBeNull();
  const leaderNoPts = [row('257', 'Rangers', undefined, 30, 1), row('256', 'Celtic', 69, 30, 2)];
  expect(stakesLine(leaderNoPts, ['256'])).toBeNull();
});

// --- tonightsAirtime --------------------------------------------------------

const bc = (show, start, channel) =>
  ({ show, start, channel, pid: 'p0000001', title: show, end: null });

test('tonightsAirtime: tonight’s broadcasts only, earliest first, London HH:MM labels', () => {
  const list = [
    bc('Match of the Day', '2026-08-29T21:25:00Z', 'BBC One'), // 22:25 BST, deliberately Z-expressed
    bc('Sportscene', '2026-08-29T19:15:00+01:00', 'BBC Scotland'),
    bc('Match of the Day', '2026-08-30T22:30:00+01:00', 'BBC One'), // tomorrow’s — out
  ];
  expect(tonightsAirtime(list, '2026-08-29T20:00:00Z')).toEqual([
    { show: 'Sportscene', timeLabel: '19:15', channel: 'BBC Scotland' },
    { show: 'Match of the Day', timeLabel: '22:25', channel: 'BBC One' },
  ]);
});

test('tonightsAirtime: a 00:15 Sunday broadcast is not Saturday’s — and is Sunday’s, labelled 00:15 not 24:15', () => {
  const sunday = [bc('Match of the Day', '2026-08-30T00:15:00+01:00', 'BBC One')];
  expect(tonightsAirtime(sunday, '2026-08-29T20:00:00Z')).toBeNull(); // Saturday evening
  expect(tonightsAirtime(sunday, '2026-08-29T23:05:00Z')).toEqual([ // Sunday 00:05 BST
    { show: 'Match of the Day', timeLabel: '00:15', channel: 'BBC One' },
  ]);
});

test('tonightsAirtime: null when none tonight, and null-tolerant throughout', () => {
  const now = '2026-08-29T20:00:00Z';
  expect(tonightsAirtime([], now)).toBeNull();
  expect(tonightsAirtime(null, now)).toBeNull();
  expect(tonightsAirtime(undefined, now)).toBeNull();
  expect(tonightsAirtime([bc('X', '2026-08-29T19:00:00+01:00', 'BBC One')], 'not a date')).toBeNull();
  expect(tonightsAirtime([null, { show: 'X', start: null, channel: null }], now)).toBeNull();
});

test('tonightsAirtime: missing show or channel carries null — the line stays honest, never invented', () => {
  const list = [{ start: '2026-08-29T19:15:00+01:00' }];
  expect(tonightsAirtime(list, '2026-08-29T20:00:00Z')).toEqual([
    { show: null, timeLabel: '19:15', channel: null },
  ]);
});
