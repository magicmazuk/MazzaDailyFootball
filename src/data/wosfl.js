// LeagueRepublic → the standard Fixture shape (spec §13.31, The Local
// Club). The WoSFL's official data home; public, keyless, documented.
// Dialect lore (live-probed 2026-08-21): away is `road*`; scores are
// STRINGS ('3') or null; team ids numeric; `result` is the played flag;
// kickoff comes from fixtureDateInMilliseconds (no timezone maths — the
// feed's own epoch); only 'Normal' statuses observed, so postponement is
// detected defensively by desc. round stays null ALWAYS: a league, so
// siblings group by "That day" and no phantom round prints anywhere.
import { monogram } from '../domain/monogram.js';
import { wosflUrl, getJson } from './client.js';
import { WOSFL } from '../domain/competitions.js';

const num = v => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

function side(teamId, name, score) {
  return {
    teamId: teamId != null ? String(teamId) : null,
    name,
    shortName: name,
    crestUrl: null, // no crests at this level — the Crest monogram fallback wears the initials
    monogram: monogram(name),
    colour: null,
    score: num(score),
    penaltyScore: null,
    agg: null,
  };
}

function status(row) {
  if (/postpon/i.test(row.fixtureDateStatusDesc ?? '') || /postpon/i.test(row.fixtureStatusDesc ?? '')) {
    return 'postponed';
  }
  return row.result ? 'ft' : 'scheduled';
}

export function adaptWosflFixtures(rows, compId) {
  return (rows ?? [])
    .filter(r => r && r.fixtureID != null && r.homeTeamName && r.roadTeamName)
    .map(r => ({
      id: String(r.fixtureID),
      compId,
      kickoff: new Date(r.fixtureDateInMilliseconds).toISOString(),
      status: status(r),
      minute: null,
      round: null,
      venue: r.venueAndSubVenueDesc ?? null,
      home: side(r.homeTeam, r.homeTeamName, r.homeScore),
      away: side(r.roadTeam, r.roadTeamName, r.roadScore),
      leg: null,
      tieCompleted: null,
      tieWinnerId: null,
    }))
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
}

// The season fetch, comp → fixtures — the wosfl branch of
// seasonFixturesQuery. One call serves the whole season; the today-window
// branch filters this same (cached) payload client-side, since junior
// results land by hand after full time and no live-minute feed exists.
export async function wosflSeasonFixtures(comp) {
  const group = WOSFL.groups[comp.id];
  const { data, asOf } = await getJson(
    wosflUrl(`/getFixturesForFixtureGroup/${group.typeID}/${group.id}.json`));
  return { fixtures: adaptWosflFixtures(data, comp.id), asOf };
}
