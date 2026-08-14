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
};

export const usePrefs = create(persist(
  (set, get) => ({
    followed: { [CELTIC.id]: CELTIC },
    hiddenComps: [],
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
  }),
  { name: 'mdf-prefs' },
));
