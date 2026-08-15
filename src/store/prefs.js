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
    // First-run seeding (spec §13.14): writes every given id ONLY when
    // seenTies is still empty and seeding hasn't happened before — so a
    // draw can only ever be announced from installation forward, never
    // retroactively for ties already published when the app was installed.
    // seenSeeded flips to true on every call, seeding or not, so a zero-tie
    // first run doesn't leave the door open to seed again later.
    seedSeenIfEmpty: tieIds => set(s => {
      if (Object.keys(s.seenTies).length > 0 || s.seenSeeded === true) {
        return { seenSeeded: true };
      }
      const seenTies = { ...s.seenTies };
      for (const id of tieIds) seenTies[id] = true;
      return { seenTies, seenSeeded: true };
    }),
  }),
  { name: 'mdf-prefs' },
));
