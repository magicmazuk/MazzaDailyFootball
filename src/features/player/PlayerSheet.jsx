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
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../../data/queries.js';
import { isKeeper } from '../../data/player.js';
import Collapse from '../../ui/Collapse.jsx';
import { SkeletonBlock, SkeletonLines } from '../../ui/Skeleton.jsx';
import { Splits } from './PlayerScreen.jsx';
import { usePlayerVideos, youtubeKey } from '../match/video.js';
import VideoCard from '../match/VideoCard.jsx';

// A swipe's vertical distance (px) past which touchend commits to
// expand/collapse rather than being read as a tap or a scroll nudge.
const SWIPE_THRESHOLD = 40;

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

// The loading shape (spec §13.21): two name/sys-line bars plus three
// headline-number blocks in the SAME grid Headline itself uses, so the
// sheet opens at a stable size instead of the old thin "Loading player…"
// strip that jumped once bio landed — swapped for the real content behind
// the bio root's .xfade-in, never a hard cut.
function HeadlineSkeleton() {
  return (
    <>
      <SkeletonLines lines={2} widths={['70%', '45%']} />
      <div className="grid grid-cols-3 gap-2 mt-4">
        {[0, 1, 2].map(i => (
          // eslint-disable-next-line react/no-array-index-key -- static placeholder slots, no reorder/identity concern
          <SkeletonBlock key={i} className="h-[20px] rounded-[2px]" />
        ))}
      </div>
    </>
  );
}

export default function PlayerSheet({ comp, playerId, onClose }) {
  const open = playerId != null;
  const { bio, stats, isLoading, isError } = usePlayer(comp, playerId);
  const reducedMotion = usePrefersReducedMotion();

  // The grab handle's real job (spec §13.18.3): swipe up (or tap the
  // handle, or tap "Full profile") expands the sheet in place to the full
  // Splits — no navigation, the underlying page stays in context. Resets
  // to collapsed whenever playerId changes, which also covers the sheet
  // closing (callers null out playerId on close).
  const [expanded, setExpanded] = useState(false);
  // Lazy-ONCE mounting (fix round 1, HIGH): the expanded Splits region
  // stays mounted once shown, even after collapsing back to the peek, so
  // Collapse glides shut around real content — see FixtureRow's fuller
  // comment on the same fix. Reset alongside `expanded` on playerId change
  // so a new player's sheet never inherits the old player's mounted Splits.
  const [everExpanded, setEverExpanded] = useState(false);
  // The Scout Player reel (spec §13.35): lazy by design — the tap flips
  // this true and only then does the hook spend quota. Resets per player.
  const [scouting, setScouting] = useState(false);
  const reel = usePlayerVideos(bio, scouting);
  useEffect(() => { setExpanded(false); setEverExpanded(false); setScouting(false); }, [playerId]);

  // Body scroll lock while open (gold review): without it a swipe on the
  // sheet also scrolls the page behind, so dismissing left the reader
  // ~100-200px from where they tapped — breaking the sheet's whole promise
  // of keeping the previous page in context. Restores the prior inline
  // value on close/unmount rather than assuming ''.
  useEffect(() => {
    if (!open) return undefined;
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prior; };
  }, [open]);

  const touchStartRef = useRef(null);
  const scrollRef = useRef(null);

  function handleTouchStart(e) {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy)) return; // horizontal-dominant swipe — ignore

    if (dy <= -SWIPE_THRESHOLD) {
      if (!expanded) { setExpanded(true); setEverExpanded(true); }
    } else if (dy >= SWIPE_THRESHOLD) {
      if (expanded) {
        // A downward swipe over scrolled content is a scroll, not a
        // collapse gesture — only collapse when already at the top.
        if ((scrollRef.current?.scrollTop ?? 0) === 0) setExpanded(false);
      } else {
        onClose();
      }
    }
  }

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
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`fixed inset-x-0 bottom-0 max-w-md mx-auto z-50 bg-paper border-t border-ink
          rounded-t-2xl px-5 pt-3.5 pb-7 flex flex-col ${
          open ? 'translate-y-0' : 'translate-y-full'} ${
          reducedMotion ? '' : 'transition-transform duration-[380ms] ease-[cubic-bezier(0.3,0.9,0.3,1)]'}`}
      >
        {/* Gated on `open` (gold review): when the sheet is closed the whole
            panel sits translated below the viewport, but the handle's 44px
            negative-margin hit area still poked ~5px into the page, forming
            an invisible z-50 strip over the bottom nav and a phantom tab
            stop on every route that mounts the sheet. */}
        {open && (
        <div className="shrink-0 flex justify-center mb-3.5">
          {/* Real button now (spec §13.18.3): visual bar stays small, but the
              button itself carries generous padding — canceled by an equal
              negative margin — so the tap/touch target clears 44px without
              growing the bar's footprint in the layout. */}
          <button type="button"
            onClick={() => { setExpanded(v => !v); setEverExpanded(true); }}
            aria-label={expanded ? 'Collapse' : 'Expand profile'}
            className="p-[20.5px] -m-[20.5px]">
            <span aria-hidden className="block w-9 h-[3px] rounded-sm bg-rule" />
          </button>
        </div>
        )}

        {isError && (
          <p className="text-muted font-sans text-[11px]">Player information unavailable.</p>
        )}
        {!isError && !bio && isLoading && <HeadlineSkeleton />}

        {bio && (
          <div className="xfade-in">
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

            {!expanded && (
              <button type="button"
                onClick={() => { setExpanded(true); setEverExpanded(true); }}
                className="block w-full text-center font-sans text-[10px] uppercase
                  tracking-[.16em] text-accent mt-4">
                Full profile →
              </button>
            )}

            {/* Scout player (spec §13.35): the scout film's per-player
                sibling. Only offered where video exists at all (key
                present; the sheet is espn-only by §13.16's own gate). */}
            {youtubeKey() && !scouting && (
              <button type="button" onClick={() => setScouting(true)}
                className="block w-full text-center font-sans text-[9.5px] uppercase
                  tracking-[.14em] text-muted underline underline-offset-4 mt-3">
                Scout player →
              </button>
            )}
            {scouting && (
              <div className="mt-4">
                <VideoCard videos={reel.data ?? []}
                  exhaustedLine="The scout's reel is empty." />
                {reel.isLoading && (
                  <p className="font-sans text-[11px] text-muted">Scouting…</p>
                )}
              </div>
            )}

            {/* Peek <-> expanded (spec §13.21, retires the parked v1.0
                finding): the old h-auto -> h-[88vh] class jump never
                interpolated. Collapse now measures/glides this region's
                height instead, exactly like every other accordion in the
                app; the inner div's own max-height keeps the sheet from
                growing past the viewport while genuinely tall content still
                scrolls internally rather than pushing the sheet off-screen. */}
            <Collapse open={expanded}>
              {everExpanded && (
                <div ref={scrollRef} className="mt-4 max-h-[60vh] overflow-y-auto overscroll-contain">
                  <Splits bio={bio} stats={stats} comp={comp} />
                  <Link to={`/player/${comp?.id}/${playerId}`} onClick={onClose}
                    className="block text-center font-sans text-[10px] uppercase tracking-[.14em] text-muted mt-2 mb-1">
                    Open as page →
                  </Link>
                </div>
              )}
            </Collapse>
          </div>
        )}
      </div>
    </>
  );
}
