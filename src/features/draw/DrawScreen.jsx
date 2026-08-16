// The draw ceremony (spec §8.3-8.5, §13.14) — the app's signature feature.
// Tap-paced: the reducer (drawEngine.js) is a pure state machine; this
// component's only job is to drive TICK from real setTimeout()s at the
// user-validated pacing (TIMINGS) and render what the reducer says.
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { byId } from '../../domain/competitions.js';
import { prettifyRound } from '../../domain/round.js';
import { fallbackRoundLabel } from '../../domain/field.js';
import { dedupePairings, phaseTieIds, roundTieIds, tieId } from '../../domain/draws.js';
import { useSeasonFixtures } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import Crest from '../../ui/Crest.jsx';
import {
  TIMINGS, drawMode, drawReducer, initDraw, isComplete, landedSides, remainingClubs, seededShuffle,
} from './drawEngine.js';

// Stable per-index jumble for the bowl pool — a fixed table, never random,
// so a re-render never reshuffles a club that hasn't moved (spec §8.4).
const JUMBLE = [
  { rot: -9, ty: -2 }, { rot: 6, ty: 3 }, { rot: -4, ty: -3 }, { rot: 11, ty: 2 },
  { rot: -7, ty: 4 }, { rot: 3, ty: -4 }, { rot: -12, ty: 1 }, { rot: 8, ty: -1 },
];
const jumbleStyle = i => {
  const j = JUMBLE[i % JUMBLE.length];
  return { transform: `rotate(${j.rot}deg) translateY(${j.ty}px)` };
};

const roundLabelFor = round => prettifyRound(round) ?? fallbackRoundLabel(round) ?? round;

// Filters a once-computed shuffle down to whichever clubs are still in the
// pool, preserving the shuffle's relative order — the "filter" half of
// shuffle-then-filter (hotfix: the bowl no longer telegraphs the draw by
// rendering clubs in tie order). Never reshuffles the remainder, so a
// club's position among its still-in-the-hat peers never moves just
// because another club landed. Matched by teamId, counted so a genuine
// replay pair (the same club appearing twice) is matched exactly once per
// occurrence rather than over- or under-matched; falls back to the club
// object itself for the rare side with no teamId.
function filterToRemaining(shuffledAll, remaining) {
  const counts = new Map();
  for (const club of remaining) {
    const key = club.teamId ?? club;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return shuffledAll.filter(club => {
    const key = club.teamId ?? club;
    const n = counts.get(key) ?? 0;
    if (n <= 0) return false;
    counts.set(key, n - 1);
    return true;
  });
}

// The club whose ball is currently on the Stage (bowl/opponents, phase
// 'revealed' only) — mirrors Stage's own derivation below — so the pool
// can find its position in the shuffled display order and pulse/collapse
// the right item, which is no longer necessarily at index 0 now that
// display order isn't reveal order. Opponents mode (spec §13.15) reveals
// one fixture's non-subject side per unit, same landed-indexed shape as
// bowl otherwise.
function revealingClub(state) {
  if (state.phase !== 'revealed') return null;
  if (state.mode === 'bowl') {
    const tieIndex = Math.floor(state.landed / 2);
    const side = state.landed % 2 === 0 ? 'home' : 'away';
    return state.ties[tieIndex]?.[side] ?? null;
  }
  if (state.mode === 'opponents') {
    const tie = state.ties[state.landed];
    if (!tie) return null;
    return tie.home?.teamId === state.subjectTeamId ? tie.away : tie.home;
  }
  return null;
}

// The venue marker ('H'/'A') for whichever fixture is currently revealed
// on the Stage, opponents mode only — the subject played at home when the
// fixture's home side is the subject, away otherwise (mirrors
// drawEngine.js's landedSides venue derivation).
function revealingVenue(state) {
  if (state.mode !== 'opponents' || state.phase !== 'revealed') return null;
  const tie = state.ties[state.landed];
  if (!tie) return null;
  return tie.home?.teamId === state.subjectTeamId ? 'H' : 'A';
}

// The tie currently being drawn (rollcall, phase 'drawing' only) — so the
// roll-call list can find its position in the shuffled display order and
// highlight the right row.
function currentTie(state) {
  return state.mode === 'rollcall' && state.phase === 'drawing' ? state.ties[state.landed] : null;
}

// Each club's jumble transform and React key are keyed off a STABLE
// ordinal (its first-appearance order in the original ties list, built
// once at ceremony mount) rather than its position in the shrinking
// remainingClubs() array — otherwise every landing shifts everyone after
// it down one slot, which both reshuffles untouched clubs' transforms and
// remounts them under a new key (losing the collapse transition, since a
// remount can't transition).
function BowlPool({ pool, revealingIndex, clubOrdinals }) {
  return (
    <div className="bg-drawer rounded-2xl p-4 flex flex-wrap justify-center gap-1.5 min-h-[104px]">
      {pool.map((club, i) => {
        const ordinal = clubOrdinals.get(club.teamId) ?? i;
        return (
          <span key={club.teamId ?? `${club.name}-${i}`} style={jumbleStyle(ordinal)}
            className={`draw-pool-item ${i === revealingIndex ? 'draw-pool-item--revealing' : ''}`}>
            <Crest side={club} size={34} />
          </span>
        );
      })}
    </div>
  );
}

function RollcallList({ rows, currentTieIndex }) {
  const currentRef = useRef(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView?.({ block: 'center' });
  }, [currentTieIndex]);

  const nameClass = (landed, isCurrent) => `text-[10.5px] leading-[1.85] break-inside-avoid ${
    landed ? 'line-through opacity-55 text-muted'
      : isCurrent ? 'text-accent text-[11.5px] font-semibold' : ''}`;

  return (
    <div className="border border-rule rounded-xl p-3 max-h-[200px] overflow-y-auto columns-2">
      {rows.flatMap(({ tie, home, away }, i) => {
        const isCurrent = i === currentTieIndex;
        const landed = home && away;
        return [
          <p key={`${tie.id}-h`} ref={isCurrent ? currentRef : null} className={nameClass(landed, isCurrent)}>
            {tie.home?.name}
          </p>,
          <p key={`${tie.id}-a`} className={nameClass(landed, isCurrent)}>
            {tie.away?.name}
          </p>,
        ];
      })}
    </div>
  );
}

function Pool({ mode, pool, state, rows, shuffledTies, clubOrdinals }) {
  // pool and shuffledTies already carry the presentation-only display
  // order (Ceremony); `indexOf` locates the specific item within that
  // order, since a shuffled position is no longer derivable from `landed`.
  const revealing = revealingClub(state);
  const revealingIndex = revealing ? pool.indexOf(revealing) : -1;

  const current = currentTie(state);
  const currentTieIndex = current ? shuffledTies.indexOf(current) : -1;

  // rows is landedSides(state) in original tie order; re-key by tie id so
  // the roll-call list can render each tie's landed status in the shuffled
  // display order instead. Rollcall-only — opponents rows carry no `tie`
  // (landedSides' opponents shape is `{ opponent, venue, ... }`, club-
  // centric rather than tie-centric), and bowl never renders RollcallList,
  // so this is skipped rather than crashing on `r.tie.id` for either.
  const displayRows = mode === 'rollcall'
    ? (() => {
      const byTieId = new Map(rows.map(r => [r.tie.id, r]));
      return shuffledTies.map(t => byTieId.get(t.id));
    })()
    : [];

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <p className="font-sans text-[10px] uppercase tracking-[.2em] text-muted">Still in the hat</p>
        <p className="font-serif text-[13px] tabular-nums">{pool.length}</p>
      </div>
      {mode === 'bowl' || mode === 'opponents'
        ? <BowlPool pool={pool} revealingIndex={revealingIndex} clubOrdinals={clubOrdinals} />
        : <RollcallList rows={displayRows} currentTieIndex={currentTieIndex} />}
    </section>
  );
}

// The stage's resting state once the draw is complete — reached either by
// tapping through every ball/tie or by "Reveal the rest", and (just as
// often) by simply arriving at an already-seen round, which opens straight
// into `complete` with no animation at all. Without this the stage would
// render nothing: a blank hole where the ball/names used to be.
function CompleteBadge() {
  return (
    <p className="font-sans text-[11px] uppercase tracking-[.18em] text-accent">★ Draw complete ★</p>
  );
}

function Stage({ state, canTap, onTap }) {
  const { phase, mode, landed } = state;
  const club = revealingClub(state);
  const venue = revealingVenue(state);
  const unit = mode === 'opponents' ? 'opponent' : 'ball';
  const hint = landed === 0 ? `Tap to draw the first ${unit}` : `Tap for the next ${unit}`;

  return (
    <button type="button" onClick={onTap} disabled={!canTap} aria-label="Draw"
      className="w-full h-[160px] flex flex-col items-center justify-center gap-2">
      {phase === 'tumbling' && (
        <span className="draw-ball" style={{ animationDuration: `${TIMINGS.tumble}ms` }}>?</span>
      )}
      {phase === 'revealed' && club && (
        <span className="draw-ball-open flex flex-col items-center gap-1.5">
          <Crest side={club} size={40} />
          <span className="font-serif text-[15px]">
            {club.name}
            {venue && <span className="font-sans text-[10px] text-muted ml-1.5 align-middle">({venue})</span>}
          </span>
        </span>
      )}
      {(phase === 'idle' || phase === 'landed') && (
        <p className="draw-breathe font-sans text-[11px] uppercase tracking-[.14em] text-muted">{hint}</p>
      )}
      {phase === 'complete' && <CompleteBadge />}
    </button>
  );
}

function RollcallStage({ state, canTap, onTap }) {
  const { phase, ties, landed } = state;
  const tie = phase === 'drawing' ? ties[landed] : null;
  const hint = landed === 0 ? 'Tap to draw the first tie' : 'Tap for the next tie';

  return (
    <button type="button" onClick={onTap} disabled={!canTap} aria-label="Draw"
      className="w-full h-[120px] flex flex-col items-center justify-center gap-2">
      {phase === 'drawing' && tie && (
        <span className="flex flex-col items-center gap-1">
          <span className="font-sans text-[10px] uppercase tracking-[.16em] text-muted">Drawing…</span>
          <span className="draw-rollcall-name font-serif text-[15px]">{tie.home?.name}</span>
          <span className="draw-rollcall-name draw-rollcall-name--second font-serif text-[15px]"
            style={{ animationDelay: `${TIMINGS.rollcallGap}ms` }}>
            {tie.away?.name}
          </span>
        </span>
      )}
      {(phase === 'idle' || phase === 'landed') && (
        <p className="draw-breathe font-sans text-[11px] uppercase tracking-[.14em] text-muted">{hint}</p>
      )}
      {phase === 'complete' && <CompleteBadge />}
    </button>
  );
}

function Slot({ side, landed, followed }) {
  if (!landed || !side) return <span className="flex-1 h-px bg-rule" />;
  return (
    <span className="draw-side-land flex items-center gap-2 flex-1 min-w-0">
      <Crest side={side} size={22} />
      <span className="font-serif text-[15px] truncate">
        {side.name}
        {followed && <span className="text-accent text-[9px] align-middle ml-1">★</span>}
      </span>
    </span>
  );
}

function TieRow({ tie, home, away, compId, followedIds, complete }) {
  const content = (
    <div className="flex items-center gap-3 py-3 border-b border-rule/70">
      <Slot side={tie.home} landed={home} followed={tie.home && followedIds.has(tie.home.teamId)} />
      <span className="font-sans text-[10px] text-muted">v</span>
      <Slot side={tie.away} landed={away} followed={tie.away && followedIds.has(tie.away.teamId)} />
    </div>
  );
  if (!complete) return content;
  return <Link to={`/match/${compId}/${tie.id}`} className="block">{content}</Link>;
}

// The opponents-mode landed row (spec §13.15): "v {Opponent} (H|A)" — the
// subject's own side is never a slot (it never reveals), so this is
// club-centric where TieRow is tie-centric. Reuses Slot (TieRow's own
// crest+name+followed-star building block) for the opponent, rather than
// NextUpRow, which is a different list (Today's "next up") with unrelated
// styling and behaviour.
function OpponentRow({ row, fixtureId, compId, followedIds, complete }) {
  const { opponent, venue, landed } = row;
  const content = (
    <div className="flex items-center gap-3 py-3 border-b border-rule/70">
      <span className="font-sans text-[10px] text-muted">v</span>
      <Slot side={opponent} landed={landed} followed={opponent && followedIds.has(opponent.teamId)} />
      {landed && <span className="font-sans text-[10px] text-muted shrink-0">({venue})</span>}
    </div>
  );
  if (!complete) return content;
  return <Link to={`/match/${compId}/${fixtureId}`} className="block">{content}</Link>;
}

function Controls({ complete, onRevealRest, onReset, compId }) {
  return (
    <div className="flex items-center gap-5 font-sans text-[10.5px] uppercase tracking-[.14em] mt-2">
      {!complete && <button type="button" onClick={onRevealRest} className="text-accent">Reveal the rest</button>}
      {complete && (
        <>
          <button type="button" onClick={onReset} className="text-accent">Start again</button>
          <Link to={`/competition/${compId}`} className="text-muted">Done</Link>
        </>
      )}
    </div>
  );
}

function Ceremony({ comp, compId, round, ties, roundFixtures, alreadySeen, markTiesSeen, followedIds, subjectClub }) {
  // A subject club (opponents mode, spec §13.15) forces 'opponents' rather
  // than the bowl/rollcall size threshold — there is no vessel-size
  // question here, only "this club's own campaign".
  const subjectTeamId = subjectClub?.teamId;
  const mode = useMemo(() => (subjectTeamId ? 'opponents' : drawMode(ties)), [ties, subjectTeamId]);
  const [state, dispatch] = useReducer(drawReducer, undefined, () => {
    const init = initDraw(ties, mode, { subjectTeamId });
    return alreadySeen ? drawReducer(init, { type: 'REVEAL_REST' }) : init;
  });
  const complete = isComplete(state);
  const seenMarkedRef = useRef(alreadySeen);

  // Each club's stable pool identity — its first-appearance order in the
  // original ties list, fixed for the life of this ceremony. Built once
  // (ties never changes identity within a mounted Ceremony) so the bowl
  // pool's jumble transform and React key never depend on the shrinking
  // remainingClubs() array's current indices.
  const clubOrdinals = useMemo(() => {
    const map = new Map();
    for (const t of ties) {
      for (const side of [t.home, t.away]) {
        if (side?.teamId != null && !map.has(side.teamId)) map.set(side.teamId, map.size);
      }
    }
    return map;
  }, [ties]);

  // Presentation-only display shuffle for the bowl pool and roll-call list
  // (hotfix: the bowl rendered remaining clubs in tie order, so the
  // leftmost badges — and the roll call's next un-struck pair — always
  // telegraphed the next reveal). Deterministic per ceremony, seeded from
  // `${compId}:${round}` so it's identical on every visit/replay but not
  // in tie order. Computed ONCE here, from the FULL original club/tie
  // list; the bowl pool is then filtered down to whichever clubs remain
  // (shuffle-then-filter, never re-shuffling the remainder) so a club
  // never jumps position just because another one landed. Reveal order
  // itself (`landed`, strictly tie-sequential), stable ordinals for the
  // jumble, keys and the engine state are all untouched — this only
  // reorders what's drawn on screen.
  // Opponents mode seeds its pool shuffle per (comp, round, subject club)
  // — task-2 brief — so two different followed clubs replaying the same
  // phase round each get their own stable-but-distinct shuffle, rather
  // than sharing the round-wide bowl/rollcall seed.
  const shuffleSeed = subjectTeamId ? `${compId}:${round}:${subjectTeamId}` : `${compId}:${round}`;
  const shuffledClubs = useMemo(
    () => seededShuffle(remainingClubs(initDraw(ties, mode, { subjectTeamId })), shuffleSeed),
    [ties, mode, subjectTeamId, shuffleSeed],
  );
  const shuffledTies = useMemo(
    () => seededShuffle(ties, `${compId}:${round}`),
    [ties, compId, round],
  );

  // Seen-marking (spec §8.5, §13.15; hotfix-two-leg-draw): fire exactly
  // once, on reaching complete, by taps or by Reveal the rest. An
  // already-seen round on arrival is already marked, so the ref starts true
  // and this never fires again for it. Opponents mode reuses phaseTieIds
  // (draws.js) — the same ids unrevealedPhaseDraws/TodayScreen key off —
  // rather than re-deriving them ad hoc. The bowl/rollcall (round-wide)
  // path marks via roundTieIds(compId, roundFixtures) — EVERY fixture in
  // the round, both legs of a two-legged pairing — not ties.map(...), since
  // `ties` here is the deduped, one-representative-per-pairing list the
  // ceremony draws from; marking only the representatives would leave a
  // two-legged round's OTHER legs permanently unseen, misreading as a
  // partially-seen round to unrevealedDraws forever after.
  useEffect(() => {
    if (complete && !seenMarkedRef.current) {
      seenMarkedRef.current = true;
      markTiesSeen(mode === 'opponents' ? phaseTieIds(comp, ties) : roundTieIds(compId, roundFixtures));
    }
  }, [complete, ties, roundFixtures, compId, comp, mode, markTiesSeen]);

  // Drive TICK from real animation timeouts, at the validated pacing. The
  // reducer never reads a clock — this is the only place time lives.
  // Opponents mode shares bowl's tumble/reveal/land timing (spec §13.15:
  // "pool shuffle, tap pacing, seen-marking semantics all inherited").
  useEffect(() => {
    if (mode === 'bowl' || mode === 'opponents') {
      if (state.phase === 'tumbling') {
        const id = setTimeout(() => dispatch({ type: 'TICK' }), TIMINGS.tumble);
        return () => clearTimeout(id);
      }
      if (state.phase === 'revealed') {
        const id = setTimeout(() => dispatch({ type: 'TICK' }), TIMINGS.holdOpen);
        return () => clearTimeout(id);
      }
    } else if (state.phase === 'drawing') {
      // Both names appear staggered by rollcallGap (CSS animation-delay);
      // land shortly after the second name has had time to register.
      const id = setTimeout(() => dispatch({ type: 'TICK' }), TIMINGS.rollcallGap * 2);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [mode, state.phase]);

  const canTap = state.phase === 'idle' || state.phase === 'landed';
  const rows = landedSides(state);
  const pool = filterToRemaining(shuffledClubs, remainingClubs(state));
  const roundLabel = roundLabelFor(round);

  return (
    <main>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-muted">
        <Link to={`/competition/${compId}`}>{comp.name}</Link>
      </p>
      <h1 className="text-[24px] mb-6 flex items-center gap-3">
        {subjectClub && <Crest side={subjectClub} size={28} />}
        <span>
          {subjectClub ? `${subjectClub.shortName ?? subjectClub.name}'s ${roundLabel} draw` : `The ${roundLabel} draw`}
        </span>
      </h1>

      <Pool mode={mode} pool={pool} state={state} rows={rows} shuffledTies={shuffledTies} clubOrdinals={clubOrdinals} />

      {mode === 'rollcall'
        ? <RollcallStage state={state} canTap={canTap} onTap={() => canTap && dispatch({ type: 'TAP' })} />
        : <Stage state={state} canTap={canTap} onTap={() => canTap && dispatch({ type: 'TAP' })} />}

      <section className="mt-2 mb-6">
        {mode === 'opponents'
          ? rows.map((row, i) => (
            <OpponentRow key={ties[i]?.id ?? i} row={row} fixtureId={ties[i]?.id}
              compId={compId} followedIds={followedIds} complete={complete} />
          ))
          : rows.map(({ tie, home, away }) => (
            <TieRow key={tie.id} tie={tie} home={home} away={away}
              compId={compId} followedIds={followedIds} complete={complete} />
          ))}
      </section>

      <Controls complete={complete} compId={compId}
        onRevealRest={() => dispatch({ type: 'REVEAL_REST' })}
        onReset={() => dispatch({ type: 'RESET' })} />
    </main>
  );
}

export default function DrawScreen() {
  // teamId (spec §13.15) is only present on the opponents route
  // (draw/:compId/:round/:teamId) — its absence is the bowl/rollcall path,
  // unchanged.
  const { compId, round, teamId } = useParams();
  const comp = byId(compId);
  const season = useSeasonFixtures(comp ?? { id: 'none', source: 'espn' });
  const seenTies = usePrefs(s => s.seenTies);
  const markTiesSeen = usePrefs(s => s.markTiesSeen);
  const followedIds = new Set(Object.keys(usePrefs(s => s.followed)));

  const roundFixtures = useMemo(() => {
    const fixtures = season.data?.fixtures ?? [];
    return fixtures.filter(f => f.round === round);
  }, [season.data, round]);

  // Opponents mode scopes ties to just the subject club's own fixtures in
  // the round (its campaign), not the whole round — unlike the bowl/
  // rollcall path, which draws every PAIRING in the round (hotfix-two-leg-
  // draw: a two-legged round publishes one FIXTURE per leg, but a draw
  // ceremony draws pairings — dedupePairings collapses same-pairing legs to
  // their earliest-kickoff representative; a no-op for single-leg rounds).
  const ties = useMemo(() => {
    if (teamId) {
      const scoped = roundFixtures.filter(f => f.home?.teamId === teamId || f.away?.teamId === teamId);
      return scoped.slice().sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    }
    return dedupePairings(roundFixtures);
  }, [roundFixtures, teamId]);

  // Subject club resolution (task-2 brief): from any of the round
  // fixtures' sides by teamId. An unknown teamId (or a round with no
  // fixtures at all) finds nothing here, but also leaves `ties` empty —
  // it falls through to the same honest "isn't available" line below,
  // with no separate guard needed.
  const subjectClub = useMemo(() => {
    if (!teamId) return null;
    for (const f of roundFixtures) {
      if (f.home?.teamId === teamId) return f.home;
      if (f.away?.teamId === teamId) return f.away;
    }
    return null;
  }, [roundFixtures, teamId]);

  if (!comp) {
    return (
      <main>
        <p className="text-muted">Unknown competition.</p>
        <Link to="/competitions" className="text-accent">Back to competitions</Link>
      </main>
    );
  }

  if (season.isLoading) {
    return <main><p className="text-muted">Loading the draw…</p></main>;
  }

  if (ties.length === 0) {
    return (
      <main>
        <p className="text-muted">This draw isn't available.</p>
        <Link to={`/competition/${compId}`} className="text-accent">Back to {comp.shortName}</Link>
      </main>
    );
  }

  const alreadySeen = ties.every(t => seenTies[tieId(compId, t.id)]);

  return (
    <Ceremony key={`${compId}:${round}:${teamId ?? ''}`} comp={comp} compId={compId} round={round}
      ties={ties} roundFixtures={roundFixtures} alreadySeen={alreadySeen} markTiesSeen={markTiesSeen}
      followedIds={followedIds} subjectClub={subjectClub} />
  );
}
