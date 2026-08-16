// The peek sheet (spec §13.16): a match-context preview that answers
// "who is this?" one tap deep, without losing your place in the match —
// mark · name · three headline numbers · "Full profile →". Identity stays
// typographic throughout (no portrait/roundel/mark), matching PlayerScreen.
//
// Presentational shell + a tiny controller: fetches via usePlayer
// internally, gated the same way usePlayer always gates itself (on
// playerId presence and comp.source === 'espn'). This is a documented
// exception to presentational purity — the brief calls it acceptable so
// every tap site only has to hand down `comp` + a playerId instead of
// threading bio/stats through MatchRoom's standouts/lineups/timeline.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../../data/queries.js';
import { isKeeper } from '../../data/player.js';

function usePrefersReducedMotion() {
  const getQuery = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null);
  const [reduced, setReduced] = useState(() => getQuery()?.matches ?? false);
  useEffect(() => {
    const mq = getQuery();
    if (!mq) return undefined;
    const handler = e => setReduced(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener?.(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener?.(handler);
    };
  }, []);
  return reduced;
}

function Headline({ items }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center mt-4">
      {items.map(it => (
        <div key={it.label}>
          <div className="text-[20px] tabular-nums">{it.value ?? '—'}</div>
          <div className="font-sans text-[8.5px] uppercase tracking-[.14em] text-muted mt-0.5">
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PlayerSheet({ comp, playerId, onClose }) {
  const open = playerId != null;
  const { bio, stats } = usePlayer(comp, playerId);
  const reducedMotion = usePrefersReducedMotion();

  const keeper = bio ? isKeeper(bio) : false;
  const sysParts = bio ? [comp?.name, bio.position, bio.nationality, bio.age].filter(Boolean) : [];
  const third = stats?.rating != null
    ? { label: 'Rating', value: stats.rating }
    : { label: 'Games', value: stats?.appearances ?? null };
  const headline = keeper
    ? [{ label: 'Saves', value: stats?.saves ?? null },
       { label: 'Clean sheets', value: stats?.cleanSheets ?? null }, third]
    : [{ label: 'Goals', value: stats?.goals ?? null },
       { label: 'Minutes', value: stats?.minutes != null ? `${stats.minutes}′` : null }, third];

  return (
    <>
      {open && (
        <button type="button" aria-label="Dismiss" onClick={onClose} className="fixed inset-0 bg-ink/20 z-40" />
      )}
      <div className={`fixed inset-x-0 bottom-0 max-w-md mx-auto z-50 bg-paper border-t border-ink
          rounded-t-2xl px-5 pt-3.5 pb-7 ${open ? 'translate-y-0' : 'translate-y-full'} ${
          reducedMotion ? '' : 'transition-transform duration-[380ms] ease-[cubic-bezier(0.3,0.9,0.3,1)]'}`}>
        <div aria-hidden className="w-9 h-[3px] rounded-sm bg-rule mx-auto mb-3.5" />
        {bio && (
          <>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[19px] truncate">{bio.name}</span>
                  {bio.shirt != null && (
                    <span className="font-sans text-[11px] text-muted shrink-0">№ {bio.shirt}</span>
                  )}
                </div>
                {sysParts.length > 0 && (
                  <p className="font-sans text-[10.5px] text-muted mt-0.5">{sysParts.join(' · ')}</p>
                )}
              </div>
              <button type="button" aria-label="Close" onClick={onClose}
                className="font-sans text-[16px] text-muted shrink-0">
                ✕
              </button>
            </div>
            <Headline items={headline} />
            <Link to={`/player/${comp?.id}/${playerId}`} onClick={onClose}
              className="block text-center font-sans text-[10px] uppercase tracking-[.16em] text-accent mt-4">
              Full profile →
            </Link>
          </>
        )}
      </div>
    </>
  );
}
