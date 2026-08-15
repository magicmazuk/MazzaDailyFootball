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
    // already shown (spec §8.1). seenSeeded guards first-run seeding
    // (below) so an installation that starts with genuinely zero published
    // cup ties doesn't keep re-seeding and swallow the first real draw.
    seenTies: {},
    seenSeeded: false,
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
    // First-run seeding (spec §13.14): the first non-empty call writes
    // every given id and latches seenSeeded so a draw can only ever be
    // announced from installation forward, never retroactively for ties
    // already published when the app was installed. Once seenSeeded is
    // true, every later call is a no-op.
    //
    // Calling contract: call only with settled query data (i.e. once the
    // fixtures query has resolved). An empty tieIds array is treated as
    // "not loaded yet", not "zero ties exist" — it is a no-op that does
    // NOT latch seenSeeded, so a caller invoked before its data is ready
    // (a load race) can't permanently swallow seeding. The cost is that a
    // genuinely empty catalogue at first run never latches either, so the
    // first real ties published get seeded (silently) instead of
    // announced — deliberately accepted as far milder than the race, and
    // moot in practice since group stages always exist for a fresh cup.
    seedSeenIfEmpty: tieIds => set(s => {
      if (s.seenSeeded === true) return {};
      if (tieIds.length === 0) return {};
      const seenTies = { ...s.seenTies };
      for (const id of tieIds) seenTies[id] = true;
      return { seenTies, seenSeeded: true };
    }),
  }),
  { name: 'mdf-prefs' },
));
