// The five o'clock edition's settled law (spec §13.43). Pure derivations
// over the standard Fixture shape, computed/official table rows and
// adapted broadcast lines — no UI, no fetching, and no clock of its own:
// every function takes `now` (Date or ISO) from its caller and only
// londonNow below may interpret it. Date.now() is never consulted here,
// so a test can pin any instant it likes.

import { computeTable } from './table.js';

// --- the London clock (self-contained, the highlights.js idiom) -------------

// en-CA prints ISO YYYY-MM-DD directly; Europe/London pins the paper's
// calendar day wherever the machine sits.
const londonDate = value => {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
};

// London wall clock as "HH:MM". hourCycle h23 keeps midnight at 00:xx
// (hour12: false alone can print 24:xx on some ICU builds).
const londonTime = value => {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London', hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
  });
};

// The pieces of `now` the settled law reads. Internal on purpose — the
// law's only clock, always fed by the caller.
const londonNow = now => {
  const date = londonDate(now);
  const time = londonTime(now);
  if (date == null || time == null) return null;
  return { date, hour: Number(time.slice(0, 2)) };
};

// Today's card: the fixtures kicking off on now's London calendar day.
export function todaysCard(fixtures, now) {
  const today = londonDate(now);
  if (today == null) return [];
  return (fixtures ?? []).filter(f => f != null && londonDate(f.kickoff) === today);
}

// The settled law: an edition exists only from 17:00 London, and only
// once at least three of today's fixtures across every desk are full
// time. results keep the caller's comp order (the registry's) and carry
// finished fixtures only — a match still live is stop-press (inPlay),
// postponed prints P–P (postponed); neither counts toward the threshold
// nor ever appears among the results.
export function editionState(fixturesByComp, now) {
  const at = londonNow(now);
  if (at == null || at.hour < 17) return null;
  const desks = (fixturesByComp ?? [])
    .filter(entry => entry?.comp != null)
    .map(({ comp, fixtures }) => {
      const today = todaysCard(fixtures, now);
      return {
        comp,
        ft: today.filter(f => f.status === 'ft'),
        live: today.filter(f => f.status === 'live'),
        postponed: today.filter(f => f.status === 'postponed'),
      };
    });
  const settled = desks.reduce((n, d) => n + d.ft.length, 0);
  if (settled < 3) return null;
  return {
    results: desks.filter(d => d.ft.length > 0).map(d => ({ comp: d.comp, fixtures: d.ft })),
    inPlay: desks.flatMap(d => d.live),
    postponed: desks.flatMap(d => d.postponed),
  };
}

// Today's movement: computeTable(all FT) against computeTable(all FT
// minus today's), as Map(teamId → positionBefore − positionAfter),
// positive = climbed. Every team in the after table gets an entry — an
// idle side can still be leapfrogged, and a held place is honestly 0. A
// team absent from the before table made its first appearance today:
// delta null, never zero. Both sides of the subtraction are the same
// pure machinery, so the movement is self-consistent by construction —
// and inherits computeTable's no-deductions caveat ("today's movement",
// never "official").
export function movement(allFt, todayFt) {
  const deltas = new Map();
  const todayIds = new Set((todayFt ?? []).filter(f => f?.id != null).map(f => f.id));
  if (todayIds.size === 0) return deltas;
  const all = (allFt ?? []).filter(f => f != null);
  const after = computeTable(all);
  const before = computeTable(all.filter(f => !todayIds.has(f.id)));
  const beforePos = new Map(before.map(r => [r.teamId, r.position]));
  for (const r of after) {
    const prev = beforePos.get(r.teamId);
    deltas.set(r.teamId, prev == null ? null : prev - r.position);
  }
  return deltas;
}

// 2nd, 3rd, 4th… 21st — the classified way.
const ordinal = n => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const unit = n % 10;
  return `${n}${unit === 1 ? 'st' : unit === 2 ? 'nd' : unit === 3 ? 'rd' : 'th'}`;
};

const rowName = r => r.shortName ?? r.name;
const pointsOf = r => (Number.isFinite(r?.points) ? r.points : null);

// The stakes line, CAPPED AT SUBTRACTION (spec §13.43) — the proven copy
// set and nothing else: "top by N" / "top on goal difference" / "Pth, N
// behind [leader]", plus games in hand when the played counts differ. No
// permutations, no clinch talk — one wrong stakes line kills trust
// forever, so anything the set cannot state honestly returns null. The
// club that speaks is the first followed one IN THE ROWS — the
// best-placed of the reader's clubs.
export function stakesLine(rows, followedIds) {
  const table = (rows ?? []).filter(r => r?.teamId != null);
  if (table.length === 0) return null;
  const followed = new Set(followedIds ?? []);
  const club = table.find(r => followed.has(r.teamId));
  if (club == null) return null;
  const leader = table[0];
  const clubPts = pointsOf(club);
  const leaderPts = pointsOf(leader);
  if (clubPts == null || leaderPts == null) return null;

  if (club === leader) {
    const second = table[1];
    const secondPts = pointsOf(second);
    if (secondPts == null) return null; // nobody beneath to subtract against
    const lead = clubPts - secondPts;
    if (lead > 0) return `${rowName(club)} top by ${lead}.`;
    if (lead === 0) return `${rowName(club)} top on goal difference from ${rowName(second)}.`;
    return null; // a "leader" behind on points isn't a table — refuse, never lie
  }

  const place = Number.isFinite(club.position) ? club.position : table.indexOf(club) + 1;
  const base = `${rowName(club)} ${ordinal(place)}, ${leaderPts - clubPts} behind ${rowName(leader)}`;
  const inHand = Number.isFinite(club.played) && Number.isFinite(leader.played)
    ? leader.played - club.played : 0;
  if (inHand === 1) return `${base}, with a game in hand.`;
  if (inHand >= 2) return `${base}, with ${inHand} games in hand.`;
  return `${base}.`;
}

// The airtime foot: tonight's broadcasts — the ones STARTING on now's
// London day — earliest first, as print-ready lines. None tonight → null
// (field absent, line off; never invent a broadcast).
export function tonightsAirtime(broadcasts, now) {
  const today = londonDate(now);
  if (today == null) return null;
  const tonight = (broadcasts ?? [])
    .filter(b => b != null && londonDate(b.start) === today)
    .sort((x, y) => new Date(x.start).getTime() - new Date(y.start).getTime())
    .map(b => ({ show: b.show ?? null, timeLabel: londonTime(b.start), channel: b.channel ?? null }));
  return tonight.length > 0 ? tonight : null;
}
