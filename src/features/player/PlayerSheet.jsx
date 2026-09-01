// The peek sheet (spec §13.16): a match-context preview that answers
// "who is this?" one tap deep, without losing your place in the match —
// mark · name · three headline numbers. Identity is typographic UNTIL the
// Scout's Dossier (spec §13.37) verifies a portrait — then a 72×92 plate
// prints left of the name block, with the bio paragraph below the
// Headline numbers (box-clamped to two lines until the sheet expands).
// The dossier only arms when a caller hands down a `club` it genuinely
// knows (TeamScreen's squad context); no club, no dossier — never a
// guessed club, and an unverified identity leaves the sheet exactly as
// the typographic original.
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
import { useDossier } from './dossier.js';
import {
  DRAG_LOCK_PX, SETTLE_EASE, SWIPE_THRESHOLD,
  releaseIntent, releaseVelocity, rubberband, settleMs,
} from './sheetPhysics.js';
import { usePlayerVideos, youtubeKey } from '../match/video.js';
import VideoCard from '../match/VideoCard.jsx';

// 2-line bio clamp until the sheet expands — the same plain CSS box-clamp
// technique Papers/FieldBoard use (no line-clamp plugin installed here).
const clampStyle = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
};

// The panel's height when the DOM can't answer (jsdom, first paint) —
// feeds rubberband dimension and the close flight's distance.
const FALLBACK_HEIGHT = 320;

// The sheet's live vertical offset, read from the COMPUTED transform —
// mid-transition this is the interpolated on-screen value (the
// presentation value, exactly what a grab should inherit — spec §13.50).
// Browsers serve a matrix; jsdom hands back the authored translateY.
function currentOffset(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  const m3 = /^matrix3d\(([^)]+)\)/.exec(t);
  if (m3) return parseFloat(m3[1].split(',')[13]) || 0;
  const m2 = /^matrix\(([^)]+)\)/.exec(t);
  if (m2) return parseFloat(m2[1].split(',')[5]) || 0;
  const ty = /^translateY\((-?[\d.]+)px\)/.exec(t);
  if (ty) return parseFloat(ty[1]) || 0;
  return 0;
}

// Kills any inline flight — timer, transition, transform, suspended text
// selection — so the class system owns the resting states again.
function stopFlight(el, timerRef, flightRef) {
  clearTimeout(timerRef.current);
  flightRef.current = false;
  if (!el) return;
  el.style.transform = '';
  el.style.transition = '';
  el.style.willChange = '';
  el.style.userSelect = '';
  el.style.webkitUserSelect = '';
}

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

export default function PlayerSheet({ comp, playerId, onClose, club = null }) {
  const open = playerId != null;
  const { bio, stats, isLoading, isError } = usePlayer(comp, playerId);
  // The Scout's Dossier (spec §13.37): with no bio yet or no club handed
  // down, this arms nothing and returns all nulls.
  const { bio: dossierBio, face, credit } = useDossier(bio, comp, club);
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
  const reel = usePlayerVideos(bio, scouting, club);
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

  // The vaul physics (spec §13.50): 1:1 pointer tracking with the grab's
  // offset, velocity-projected release, interruptible settles. The drag
  // writes the transform straight to the element — no per-move re-render.
  const sheetRef = useRef(null);
  const scrollRef = useRef(null);
  // The live gesture; null between touches. Carries the grab point, any
  // inherited mid-flight offset, the direction lock and velocity history.
  const dragRef = useRef(null);
  const settleTimer = useRef(null);
  // True while an inline settle transition is flying — a pointer-down in
  // that window freezes the sheet where it IS on screen.
  const inFlight = useRef(false);

  // A fresh player (or a close) resets any leftover flight.
  useEffect(() => {
    dragRef.current = null;
    stopFlight(sheetRef.current, settleTimer, inFlight);
    return () => stopFlight(sheetRef.current, settleTimer, inFlight);
  }, [playerId]);

  // Hands the sheet to an inline transition whose duration inherits the
  // finger's speed; cleanup on a TIMER (house law — jsdom and reduced
  // motion can't fire transition events), running `then` as it lands.
  function flyTo(targetPx, distance, velocity, then) {
    const el = sheetRef.current;
    if (!el) { then?.(); return; }
    const ms = settleMs(distance, velocity);
    inFlight.current = true;
    el.style.userSelect = '';
    el.style.webkitUserSelect = '';
    el.style.transition = `transform ${ms}ms ${SETTLE_EASE}`;
    el.style.transform = `translateY(${targetPx}px)`;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      stopFlight(el, settleTimer, inFlight);
      then?.();
    }, ms);
  }

  function handlePointerDown(e) {
    if (!open) return;
    clearTimeout(settleTimer.current);
    const el = sheetRef.current;
    const baseY = el ? currentOffset(el) : 0;
    if (el && inFlight.current) {
      // The marquee vaul move: a grab mid-settle freezes the sheet at its
      // on-screen position — a closing sheet can be caught and carried
      // back up. Tracking resumes from exactly here.
      el.style.transition = 'none';
      el.style.transform = `translateY(${baseY}px)`;
    }
    inFlight.current = false;
    dragRef.current = {
      startX: e.clientX, startY: e.clientY, baseY, lock: null,
      startedInScroller: scrollRef.current?.contains(e.target) ?? false,
      samples: [{ y: e.clientY, t: performance.now() }],
    };
  }

  function handlePointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    d.samples.push({ y: e.clientY, t: performance.now() });
    if (d.samples.length > 12) d.samples.shift();
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.lock) {
      // ~10px of hysteresis before a direction commits — under it a touch
      // is still a tap and children keep their clicks (no capture yet).
      if (Math.abs(dx) < DRAG_LOCK_PX && Math.abs(dy) < DRAG_LOCK_PX) return;
      if (Math.abs(dx) > Math.abs(dy)) { d.lock = 'h'; return; }
      const atTop = (scrollRef.current?.scrollTop ?? 0) === 0;
      // A vertical gesture born inside the splits scroller belongs to the
      // scroll when content is scrolled above, or when it heads upward
      // (reading down the list) — only a downward pull at the very top is
      // a sheet gesture.
      if (expanded && d.startedInScroller && (!atTop || dy < 0)) { d.lock = 'scroll'; return; }
      d.lock = 'v';
      const el = sheetRef.current;
      if (el) {
        try { el.setPointerCapture?.(e.pointerId); } catch { /* jsdom lacks capture */ }
        el.style.transition = 'none';
        el.style.willChange = 'transform';
        el.style.userSelect = 'none';
        el.style.webkitUserSelect = 'none';
      }
    }
    if (d.lock !== 'v') return;
    const el = sheetRef.current;
    if (!el) return;
    const offset = d.baseY + dy;
    // Upward past the resting line rubber-bands (Apple's 0.55) — display
    // only; the release decision reads raw travel.
    const shown = offset < 0
      ? -rubberband(-offset, el.getBoundingClientRect().height || FALLBACK_HEIGHT)
      : offset;
    el.style.transform = `translateY(${shown}px)`;
  }

  function handlePointerUp(e) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const el = sheetRef.current;
    if (el) { el.style.userSelect = ''; el.style.webkitUserSelect = ''; }
    if (d.lock === 'h' || d.lock === 'scroll') return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.lock && Math.abs(dx) > Math.abs(dy)) return; // horizontal-dominant — ignore
    const now = performance.now();
    d.samples.push({ y: e.clientY, t: now });
    const velocity = releaseVelocity(d.samples, now);
    const absY = d.baseY + dy;
    const atTop = (scrollRef.current?.scrollTop ?? 0) === 0;
    const intent = releaseIntent({ absY, velocity, expanded, atTop });
    // Only a gesture that actually moved the sheet needs a settle — a tap
    // (or an undisplaced threshold release) must leave the styles alone.
    const displaced = d.lock === 'v' || d.baseY !== 0;

    if (intent === 'close') {
      if (reducedMotion || !el) {
        stopFlight(el, settleTimer, inFlight);
        onClose();
        return;
      }
      const height = el.getBoundingClientRect().height || FALLBACK_HEIGHT;
      // onClose rides the settle timer: the content stays aboard for the
      // flight down, and a mid-flight grab can still rescue the sheet.
      flyTo(height, Math.max(height - absY, SWIPE_THRESHOLD), velocity, onClose);
      return;
    }
    if (intent === 'expand') { setExpanded(true); setEverExpanded(true); }
    if (intent === 'collapse') setExpanded(false);
    if (displaced) {
      if (reducedMotion) stopFlight(el, settleTimer, inFlight);
      else flyTo(0, Math.abs(absY), velocity);
    }
  }

  function handlePointerCancel() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const el = sheetRef.current;
    if (el) { el.style.userSelect = ''; el.style.webkitUserSelect = ''; }
    if (d.lock !== 'v' && d.baseY === 0) return;
    // The browser claimed the gesture (native scroll won) — glide home.
    if (reducedMotion || !el) { stopFlight(el, settleTimer, inFlight); return; }
    flyTo(0, Math.abs(currentOffset(el)) || SWIPE_THRESHOLD, 0);
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
        ref={sheetRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        // touch-action none keeps the browser's hands off gestures on the
        // panel itself; the splits scroller is NOT in this chain for its
        // own scrolling, so native scroll inside it stays alive (§13.50).
        style={{ touchAction: 'none' }}
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
              {face != null && (
                // The plate, a size down (spec §13.37): same printed-photo
                // treatment as the page's 96×122 column, on the xfade —
                // enrichment arrives, never reserves space.
                <img src={face.src} alt="" loading="lazy" referrerPolicy="no-referrer"
                  className="xfade-in w-[72px] h-[92px] rounded-[4px] border border-ink/35
                             object-cover bg-drawer shrink-0" />
              )}
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

            {/* The dossier bio (spec §13.37), below the Headline numbers —
                box-clamped to two lines in the peek; the clamp lifts when
                the sheet expands. Credit only when a plate renders. */}
            {dossierBio != null && (
              <p style={expanded ? undefined : clampStyle}
                className="xfade-in font-serif text-[13.5px] leading-relaxed mt-4">
                {dossierBio}
              </p>
            )}
            {face != null && (
              <p className="xfade-in font-sans text-[8.5px] uppercase tracking-[.14em] text-muted mt-2">
                Photograph · {credit}
              </p>
            )}

            {/* "Full profile →" retired (user trim, 2026-08-25): the anchor
                bar already says a flip-up awaits — one affordance, not two. */}

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
                  {/* The club rides along as location state so the full
                      page's dossier keeps the verified context (§13.37). */}
                  <Link to={`/player/${comp?.id}/${playerId}`} state={{ club }} onClick={onClose}
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
