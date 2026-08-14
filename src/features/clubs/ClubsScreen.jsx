import { useState } from 'react';
import { COMPETITIONS } from '../../domain/competitions.js';
import { useAllSeasonFixtures, useAllTeams } from '../../data/queries.js';
import { CELTIC, usePrefs } from '../../store/prefs.js';
import Crest from '../../ui/Crest.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import { searchTeams } from './searchTeams.js';

const ESPN_COMPS = COMPETITIONS.filter(c => c.source === 'espn');
const BBC_COMPS = COMPETITIONS.filter(c => c.source === 'bbc');

// BBC teams have no /teams endpoint — derive them from season fixtures.
function bbcTeams(seasonResults) {
  const seen = new Map();
  for (const r of seasonResults) {
    for (const f of r.data?.fixtures ?? []) {
      for (const side of [f.home, f.away]) {
        if (side.teamId && !seen.has(side.teamId)) {
          seen.set(side.teamId, { id: side.teamId, name: side.name,
            shortName: side.shortName, crestUrl: null,
            monogram: side.monogram, colour: null });
        }
      }
    }
  }
  return [...seen.values()];
}

export default function ClubsScreen() {
  const [q, setQ] = useState('');
  const { follow, unfollow, toggleComp } = usePrefs();
  const followed = usePrefs(s => s.followed);
  const hidden = usePrefs(s => s.hiddenComps);

  const espnTeamResults = useAllTeams(ESPN_COMPS);
  const bbcSeasonResults = useAllSeasonFixtures(BBC_COMPS);
  const allTeams = [
    ...espnTeamResults.flatMap(r => r.data?.teams ?? []),
    ...bbcTeams(bbcSeasonResults),
  ];
  const results = searchTeams(allTeams, q);

  return (
    <main>
      <h1 className="text-[27px] mb-8">Clubs</h1>

      <section className="mb-9">
        <SectionLabel>★ Following</SectionLabel>
        {Object.values(followed).map(club => (
          <div key={club.id} className="flex items-center gap-3 py-3 border-b border-rule/70">
            <Crest side={club} size={24} />
            <span className="flex-1 text-[16px] truncate">{club.name}</span>
            {club.id === CELTIC.id
              ? <span className="font-sans text-[9px] uppercase tracking-[.14em] text-accent">
                  Your club
                </span>
              : <button type="button" onClick={() => unfollow(club.id)}
                  aria-label={`Unfollow ${club.name}`}
                  className="font-sans text-[9px] uppercase tracking-[.14em] text-muted
                             underline underline-offset-4">
                  Unfollow
                </button>}
          </div>
        ))}
      </section>

      <section className="mb-9">
        <SectionLabel muted>Find a club</SectionLabel>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search for a club…"
          className="w-full bg-transparent border-b border-ink py-2.5 font-serif text-[16px]
                     placeholder:text-muted focus:outline-none"
        />
        {results.map(t => {
          const isFollowed = Boolean(followed[t.id]);
          return (
            <div key={t.id} className="flex items-center gap-3 py-3 border-b border-rule/70">
              <Crest side={t} size={24} />
              <span className="flex-1 text-[16px] truncate">{t.name}</span>
              <button type="button"
                aria-label={`${isFollowed ? 'Unfollow' : 'Follow'} ${t.name}`}
                onClick={() => (isFollowed ? unfollow(t.id) : follow(t))}
                className="font-sans text-[9px] uppercase tracking-[.14em] underline
                           underline-offset-4 text-ink">
                {isFollowed ? '★ Following' : '☆ Follow'}
              </button>
            </div>
          );
        })}
      </section>

      <section>
        <SectionLabel muted>Competitions shown</SectionLabel>
        {COMPETITIONS.map(c => (
          <label key={c.id} className="flex items-center gap-3 py-2.5 border-b border-rule/60
                                       font-serif text-[15px]">
            <input type="checkbox" checked={!hidden.includes(c.id)}
              onChange={() => toggleComp(c.id)} aria-label={c.name}
              className="accent-[#A11B1B]" />
            <span className="flex-1">{c.name}</span>
          </label>
        ))}
      </section>
    </main>
  );
}
