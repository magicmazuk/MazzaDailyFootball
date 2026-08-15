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
  const seedSeenIfEmpty = usePrefs(s => s.seedSeenIfEmpty);
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
  // Seeding contract (store/prefs.js seedSeenIfEmpty): only ever call it
  // once every cup season query has settled (succeeded or errored) — never
  // while one is still loading. An isError comp is simply absent from
  // cupFixturesByComp below; additive seeding catches it on a later
  // successful load, per the brief.
  const allSettled = cupResults.every(r => r.isSuccess || r.isError);
  const cupFixturesByComp = cupResults
    .filter(r => r.isSuccess)
    .map(r => ({ comp: r.comp, fixtures: r.data?.fixtures ?? [] }));

  useEffect(() => {
    if (allSettled && cupFixturesByComp.length) seedSeenIfEmpty(allTieIds(cupFixturesByComp));
    // cupFixturesByComp is rebuilt fresh every render; its length is a
    // stable-enough dependency proxy for "the settled cup catalogue
    // arrived" without re-running on every subsequent render once
    // settled — seedSeenIfEmpty is a no-op past its first successful call
    // regardless, so this is a minor efficiency choice, not a correctness
    // one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSettled, cupFixturesByComp.length, seedSeenIfEmpty]);

  const draws = unrevealedDraws(cupFixturesByComp, seenTies);
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
