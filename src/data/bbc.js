// BBC → domain adapter for Scottish League One and Two (spec §3.3), and
// for the cup competitions BBC fills in behind ESPN (§13.7). The BBC feed
// never provides crests — every side falls back to its monogram — or
// venue data, but a cup payload's secondaryGroups[].displayLabel does
// carry the round ('2nd Round', 'Quarter-Finals', …) — bbcRoundSlug()
// normalises that into the same slug shape ESPN's season.slug uses.
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

// Numbered rounds ('1st Round' .. '<n>th Round') map to 'round-<n>';
// knockout stage names map to the same slugs ESPN uses; anything else
// (group/league phase labels, or no label at all) is null — the field
// domain already treats a null round as invisible rather than an error.
export function bbcRoundSlug(label) {
  if (!label) return null;
  const numbered = label.match(/^(\d+)(?:st|nd|rd|th) Round$/i);
  if (numbered) return `round-${numbered[1]}`;
  if (/quarter.?finals?/i.test(label)) return 'quarterfinals';
  if (/semi.?finals?/i.test(label)) return 'semifinals';
  if (/^final$/i.test(label)) return 'final';
  return null;
}

export function adaptBbcFixtures(json, compId) {
  const events = (json?.eventGroups ?? []).flatMap(g =>
    (g.secondaryGroups ?? []).flatMap(sg => {
      const round = bbcRoundSlug(sg.displayLabel);
      return (sg.events ?? []).map(ev => ({ ev, round }));
    }));
  return events.map(({ ev, round }) => ({
    id: ev.id,
    compId,
    kickoff: ev.startDateTime,
    status: /postpon/i.test(ev.statusComment?.accessible ?? '')
      ? 'postponed'
      : STATUS[ev.status] ?? 'scheduled',
    minute: ev.periodLabel?.value ?? null,
    round,
    venue: null,
    home: side(ev.home),
    away: side(ev.away),
  }));
}
