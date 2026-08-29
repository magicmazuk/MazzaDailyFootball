// Followed clubs and hidden competitions — the app's only persistent
// state (spec §4.5). Celtic is fixed (Global Constraints) and seeded
// into the initial state; unfollow() refuses to remove it.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const CELTIC = {
  id: '256',
  name: 'Celtic',
  crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/256.png',
  monogram: 'CE',
  colour: '009921',
  compId: 'sco.1',
};

export const usePrefs = create(persist(
  (set, get) => ({
    followed: { [CELTIC.id]: CELTIC },
    hiddenComps: [],
    // tieId ('${compId}:${fixtureId}') -> true, for every draw ceremony
    // already shown (spec §8.1).
    seenTies: {},
    // compId -> true, once that comp's own first-run baseline has been
    // seeded (spec §13.14). Per-competition, deliberately — see
    // seedCompIfNeeded below for why a single global latch doesn't work.
    seededComps: {},
    // Vestigial: the OLD global first-run latch, superseded by
    // seededComps. No code writes this anymore — it is read-only, kept
    // solely so seedCompIfNeeded can recognise an install that already
    // seeded under the old scheme (see there). A brand-new install never
    // has this true.
    seenSeeded: false,
    // The Full Table preference (spec §13.33): the reader's standing choice
    // between the compact points column and the full classified print.
    fullTable: false,
    toggleFullTable: () => set(s => ({ fullTable: !s.fullTable })),
    // The goal wire's two forms (spec 13.44 addendum): the revolving line
    // or the stacked latest-goals - the reader's choice, kept.
    goalWireMode: 'line',
    toggleGoalWireMode: () => set(s => ({
      goalWireMode: s.goalWireMode === 'line' ? 'stack' : 'line',
    })),
    follow: club => set(s => ({ followed: { ...s.followed, [club.id]: club } })),
    unfollow: id => {
      if (id === CELTIC.id) return;
      set(s => {
        const followed = { ...s.followed };
        delete followed[id];
        return { followed };
      });
    },
    isFollowed: id => Boolean(get().followed[id]),
    toggleComp: id => set(s => ({
      hiddenComps: s.hiddenComps.includes(id)
        ? s.hiddenComps.filter(x => x !== id)
        : [...s.hiddenComps, id],
    })),
    markTiesSeen: tieIds => set(s => {
      const seenTies = { ...s.seenTies };
      for (const id of tieIds) seenTies[id] = true;
      return { seenTies };
    }),
    // Per-competition first-run seeding (spec §13.14; fix, replacing the
    // old global seedSeenIfEmpty/seenSeeded latch after two live defects):
    // a single global latch required EVERY cup query to settle before
    // seeding ANY comp — a comp that resolved quickly sat unseeded (its
    // pre-existing round misread as a "new" draw) for as long as any
    // sibling comp stayed pending, and a comp whose query failed could
    // never seed at all, even after a later successful retry, once the
    // global latch had already fired for its siblings. Seeding per comp
    // fixes both: each comp's own baseline is established the moment ITS
    // OWN query succeeds, independent of every other comp's state.
    //
    // seedCompIfNeeded(compId, tieIds):
    //  - no-op if this comp is already latched (seededComps[compId]).
    //  - legacy migration: an install that already ran under the OLD
    //    global seenSeeded:true latch has every cup tie published at that
    //    time marked seen in seenTies already — there is nothing left to
    //    seed, only the per-comp latch needs to catch up. Rather than a
    //    persist version-bump migration, this is the simpler check: when
    //    seenSeeded is true, latch the comp WITHOUT touching seenTies (it
    //    already covers it), so a legacy install never re-seeds and never
    //    floods a false "new draw" card for ties that predate the update.
    //    (Trade-off, accepted: a legacy install never does real per-comp
    //    seeding again, even for a brand-new comp added to the registry
    //    later — judged acceptable since seenTies already holds its own
    //    accurate history from the old scheme.)
    //  - otherwise, same load-race contract as the old function: an empty
    //    tieIds array means "not loaded yet", not "zero ties exist" — a
    //    no-op that does NOT latch, so a caller invoked before its query
    //    resolves can't permanently swallow seeding for that comp.
    //  - otherwise: seed every given id into seenTies and latch this comp.
    seedCompIfNeeded: (compId, tieIds) => set(s => {
      if (s.seededComps[compId]) return {};
      if (s.seenSeeded) return { seededComps: { ...s.seededComps, [compId]: true } };
      if (tieIds.length === 0) return {};
      const seenTies = { ...s.seenTies };
      for (const id of tieIds) seenTies[id] = true;
      return { seenTies, seededComps: { ...s.seededComps, [compId]: true } };
    }),
  }),
  { name: 'mdf-prefs' },
));
