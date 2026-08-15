import { useEffect } from 'react';
import { COMPETITIONS, byId } from '../../domain/competitions.js';
import { useAllSeasonFixtures, useTodayWindows, useTable } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import { partitionToday } from './partition.js';
import { nextUpForFollowed } from './nextUp.js';
import { upcomingTv } from './onTv.js';
import { allTieIds, tieId, unrevealedDraws } from '../../domain/draws.js';
import TodayView from './TodayView.jsx';

export default function TodayScreen() {
  const followed = usePrefs(s => s.followed);
  const hidden = usePrefs(s => s.hiddenComps);
  const seenTies = usePrefs(s => s.seenTies);
  const seededComps = usePrefs(s => s.seededComps);
  const seedCompIfNeeded = usePrefs(s => s.seedCompIfNeeded);
  const comps = COMPETITIONS.filter(c => !hidden.includes(c.id));
  const results = useTodayWindows(comps);
  const seasons = useAllSeasonFixtures(comps);
  const spl = useTable(byId('sco.1'));
  const epl = useTable(byId('eng.1'));

  const followedIds = new Set(Object.keys(followed));

  // Cup season results paired with their comp, registry order (comps is
  // COMPETITIONS filtered by hiddenComps, never reordered) — seasons[i]
  // lines up with comps[i] since both are built from that same array.
  const cupResults = comps
    .map((comp, i) => ({ comp, ...seasons[i] }))
    .filter(r => r.comp.type === 'cup');
  const cupFixturesByComp = cupResults
    .filter(r => r.isSuccess)
    .map(r => ({ comp: r.comp, fixtures: r.data?.fixtures ?? [] }));

  // Per-competition seeding (store/prefs.js seedCompIfNeeded, fix per
  // review): seed EACH comp the moment ITS OWN query succeeds, never
  // waiting on siblings — an isError comp is simply not seeded yet; it
  // self-heals on a later successful load, when this effect re-runs and
  // finds it among the successful ids.
  const successfulCupIds = cupFixturesByComp.map(({ comp }) => comp.id).join(',');
  useEffect(() => {
    for (const { comp, fixtures } of cupFixturesByComp) {
      seedCompIfNeeded(comp.id, allTieIds([{ comp, fixtures }]));
    }
    // successfulCupIds (not cupFixturesByComp itself, a fresh array every
    // render) is the dependency: it changes exactly when the SET of
    // successful cup comps changes, i.e. when there's genuinely new
    // settling to react to. seedCompIfNeeded is a no-op past a comp's own
    // first successful call regardless, so re-running for an unchanged set
    // would be harmless anyway — this just avoids doing it every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successfulCupIds, seedCompIfNeeded]);

  // No-flash gating (fix per review): a comp's fixtures only feed
  // unrevealedDraws() once THAT comp has actually been seeded — not merely
  // loaded. Otherwise, for the one render between "query succeeded" and
  // "seeding effect committed", that comp's pre-existing (not genuinely
  // new) round would misread as an unrevealed draw against an unseeded
  // seenTies. First paint shows no cards; a card appears only once its own
  // comp's baseline exists and a round is genuinely unseen against it.
  const seededCupFixturesByComp = cupFixturesByComp.filter(({ comp }) => seededComps[comp.id]);
  const draws = unrevealedDraws(seededCupFixturesByComp, seenTies);
  // Today-scoped hiding (spec §13.14): an unrevealed tie's fixture is
  // replaced by its invitation card everywhere a bare FixtureRow could
  // otherwise leak the pairing — the today window (partitionToday/onTv)
  // and the season cache nextUp reads from.
  const unrevealedIds = new Set(
    draws.flatMap(d => d.ties.map(t => tieId(d.comp.id, t.id))));
  const hideUnrevealed = f => !unrevealedIds.has(tieId(f.compId, f.id));

  const fixtures = results.flatMap(r => r.data?.fixtures ?? []).filter(hideUnrevealed);
  const asOf = results.map(r => r.data?.asOf).find(Boolean) ?? null;
  const allSeason = seasons.flatMap(r => r.data?.fixtures ?? []).filter(hideUnrevealed);
  const nextUp = nextUpForFollowed(Object.values(followed), allSeason, new Date());
  const onTv = upcomingTv(allSeason, new Date());
  // results.every() on an empty array is vacuously true, so with zero
  // competitions (everything hidden) this must not read as "still loading".
  const loading = comps.length > 0 && results.every(r => r.isLoading);

  if (loading) return <p className="text-muted">Fetching today's football…</p>;
  return (
    <TodayView
      partition={partitionToday(fixtures, followedIds, new Date())}
      followedIds={followedIds}
      date={new Date()}
      asOf={asOf}
      nextUp={nextUp}
      onTv={onTv}
      draws={draws}
      quickTables={[
        { comp: byId('sco.1'), rows: spl.data?.rows ?? [] },
        { comp: byId('eng.1'), rows: epl.data?.rows ?? [] },
      ]}
    />
  );
}
