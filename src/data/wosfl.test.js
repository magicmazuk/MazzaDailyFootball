import { expect, test } from 'vitest';
import { adaptWosflFixtures } from './wosfl.js';

// Real rows, captured live from LeagueRepublic on 2026-08-21 (spec §13.31)
// — Bellshill 3-2 Neilston (played) and Maybole v Neilston (scheduled).
const played = {
  additionalScore: null, fixtureDate: '20260725 14:00',
  fixtureDateInMilliseconds: 1784984400000,
  fixtureDateStatusDesc: 'Normal / Scheduled', fixtureDateStatusID: 1,
  fixtureID: 44293957, fixtureNote: null, fixtureStatus: 0, fixtureStatusDesc: 'Normal',
  homeScore: '3', homeScoreNote: null, homeTeamName: 'Bellshill Athletic',
  noResultOutcome: false, result: true, roadScore: '2', roadScoreNote: null,
  roadTeamName: 'Neilston', roundDesc: null, shortCode: 'L',
  venueAndSubVenueDesc: 'Rockburn Park', homeTeam: 147611871, roadTeam: 168281523,
};
const scheduled = {
  ...played, fixtureID: 44296036, fixtureDate: '20260822 14:00',
  fixtureDateInMilliseconds: 1787403600000, homeScore: null, roadScore: null,
  result: false, homeTeamName: 'Maybole Juniors', homeTeam: 753004191,
  venueAndSubVenueDesc: 'Ladywell Stadium',
};

test('a played row becomes an ft Fixture — road is away, string scores go numeric, kickoff from milliseconds', () => {
  const [f] = adaptWosflFixtures([played], 'wosfl.first');
  expect(f.id).toBe('44293957');
  expect(f.compId).toBe('wosfl.first');
  expect(f.status).toBe('ft');
  expect(f.kickoff).toBe(new Date(1784984400000).toISOString());
  expect(f.venue).toBe('Rockburn Park');
  expect(f.home.teamId).toBe('147611871');
  expect(f.home.name).toBe('Bellshill Athletic');
  expect(f.home.score).toBe(3);
  expect(f.away.teamId).toBe('168281523');
  expect(f.away.name).toBe('Neilston');
  expect(f.away.score).toBe(2);
});

test('a scheduled row carries null scores and scheduled status — never a phantom 0-0', () => {
  const [f] = adaptWosflFixtures([scheduled], 'wosfl.first');
  expect(f.status).toBe('scheduled');
  expect(f.home.score).toBeNull();
  expect(f.away.score).toBeNull();
});

test('a postponed date status maps to postponed regardless of result flag', () => {
  const [f] = adaptWosflFixtures(
    [{ ...scheduled, fixtureDateStatusDesc: 'Postponed' }], 'wosfl.first');
  expect(f.status).toBe('postponed');
});

test('the shape matches the house Fixture: monogram fallback for crestless clubs, league nulls everywhere they belong', () => {
  const [f] = adaptWosflFixtures([played], 'wosfl.first');
  // Bellshill wear their curated badge now — and so do Neilston, since the
  // editor's second badge batch. Maybole (scheduled row) hold the line as
  // the honest monogram example.
  expect(f.home.crestUrl).toBe('/crests/wosfl/147611871.png');
  expect(f.away.crestUrl).toBe('/crests/wosfl/168281523.png');
  const [sched] = adaptWosflFixtures([scheduled], 'wosfl.first');
  expect(sched.home.crestUrl).toBeNull(); // Maybole Juniors — still monogram
  expect(f.home.monogram).toBe('BA');
  expect(f.home.colour).toBeNull();
  expect(f.home.penaltyScore).toBeNull();
  expect(f.home.agg).toBeNull();
  // round stays null ALWAYS — a league, so siblings group by "That day"
  // and no phantom round ever prints on a context line.
  expect(f.round).toBeNull();
  expect(f.minute).toBeNull();
  expect(f.leg).toBeNull();
  expect(f.tieCompleted).toBeNull();
  expect(f.tieWinnerId).toBeNull();
});

test('rows without ids or names are dropped, never crashed on', () => {
  expect(adaptWosflFixtures([{}, null, played], 'wosfl.first')).toHaveLength(1);
  expect(adaptWosflFixtures(undefined, 'wosfl.first')).toEqual([]);
});
