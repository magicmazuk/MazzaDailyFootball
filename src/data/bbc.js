// BBC → domain adapter for Scottish League One and Two (spec §3.3).
// The BBC feed never provides crests — every side falls back to its
// monogram — and provides no round or venue data.
import { monogram } from '../domain/monogram.js';

const STATUS = { PreEvent: 'scheduled', MidEvent: 'live', PostEvent: 'ft' };

function side(s = {}) {
  const name = s.fullName ?? '';
  return {
    teamId: s.id ?? null,
    name,
    shortName: s.shortName ?? name,
    crestUrl: null,
    monogram: monogram(name),
    colour: null,
    score: s.score != null && s.score !== '' ? Number(s.score) : null,
  };
}

export function adaptBbcFixtures(json, compId) {
  const events = (json?.eventGroups ?? []).flatMap(g =>
    (g.secondaryGroups ?? []).flatMap(sg => sg.events ?? []));
  return events.map(ev => ({
    id: ev.id,
    compId,
    kickoff: ev.startDateTime,
    status: /postpon/i.test(ev.statusComment?.accessible ?? '')
      ? 'postponed'
      : STATUS[ev.status] ?? 'scheduled',
    minute: ev.periodLabel?.value ?? null,
    round: null,
    venue: null,
    home: side(ev.home),
    away: side(ev.away),
  }));
}
