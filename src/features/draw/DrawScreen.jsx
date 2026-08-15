// The draw ceremony (spec §8.3-8.5, §13.14) — the app's signature feature.
// Tap-paced: the reducer (drawEngine.js) is a pure state machine; this
// component's only job is to drive TICK from real setTimeout()s at the
// user-validated pacing (TIMINGS) and render what the reducer says.
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { byId } from '../../domain/competitions.js';
import { prettifyRound } from '../../domain/round.js';
import { fallbackRoundLabel } from '../../domain/field.js';
import { tieId } from '../../domain/draws.js';
import { useSeasonFixtures } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import Crest from '../../ui/Crest.jsx';
import {
  TIMINGS, drawMode, drawReducer, initDraw, isComplete, landedSides, remainingClubs,
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

function Pool({ mode, pool, state, rows, clubOrdinals }) {
  const revealingIndex = mode === 'bowl' && state.phase === 'revealed' ? 0 : -1;
  const currentTieIndex = mode === 'rollcall' && state.phase === 'drawing' ? state.landed : -1;
  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <p className="font-sans text-[10px] uppercase tracking-[.2em] text-muted">Still in the hat</p>
        <p className="font-serif text-[13px] tabular-nums">{pool.length}</p>
      </div>
      {mode === 'bowl'
        ? <BowlPool pool={pool} revealingIndex={revealingIndex} clubOrdinals={clubOrdinals} />
        : <RollcallList rows={rows} currentTieIndex={currentTieIndex} />}
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
  const { phase, ties, landed } = state;
  const tieIndex = Math.floor(landed / 2);
  const side = landed % 2 === 0 ? 'home' : 'away';
  const club = ties[tieIndex]?.[side] ?? null;
  const hint = landed === 0 ? 'Tap to draw the first ball' : 'Tap for the next ball';

  return (
    <button type="button" onClick={onTap} disabled={!canTap} aria-label="Draw"
      className="w-full h-[160px] flex flex-col items-center justify-center gap-2">
      {phase === 'tumbling' && (
        <span className="draw-ball" style={{ animationDuration: `${TIMINGS.tumble}ms` }}>?</span>
      )}
      {phase === 'revealed' && club && (
        <span className="draw-ball-open flex flex-col items-center gap-1.5">
          <Crest side={club} size={40} />
          <span className="font-serif text-[15px]">{club.name}</span>
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

function Ceremony({ comp, compId, round, ties, alreadySeen, markTiesSeen, followedIds }) {
  const mode = useMemo(() => drawMode(ties), [ties]);
  const [state, dispatch] = useReducer(drawReducer, undefined, () => {
    const init = initDraw(ties, mode);
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

  // Seen-marking (spec §8.5): fire exactly once, on reaching complete, by
  // taps or by Reveal the rest. An already-seen round on arrival is already
  // marked, so the ref starts true and this never fires again for it.
  useEffect(() => {
    if (complete && !seenMarkedRef.current) {
      seenMarkedRef.current = true;
      markTiesSeen(ties.map(t => tieId(compId, t.id)));
    }
  }, [complete, ties, compId, markTiesSeen]);

  // Drive TICK from real animation timeouts, at the validated pacing. The
  // reducer never reads a clock — this is the only place time lives.
  useEffect(() => {
    if (mode === 'bowl') {
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
  const pool = remainingClubs(state);
  const roundLabel = roundLabelFor(round);

  return (
    <main>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-muted">
        <Link to={`/competition/${compId}`}>{comp.name}</Link>
      </p>
      <h1 className="text-[24px] mb-6">The {roundLabel} draw</h1>

      <Pool mode={mode} pool={pool} state={state} rows={rows} clubOrdinals={clubOrdinals} />

      {mode === 'bowl'
        ? <Stage state={state} canTap={canTap} onTap={() => canTap && dispatch({ type: 'TAP' })} />
        : <RollcallStage state={state} canTap={canTap} onTap={() => canTap && dispatch({ type: 'TAP' })} />}

      <section className="mt-2 mb-6">
        {rows.map(({ tie, home, away }) => (
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
  const { compId, round } = useParams();
  const comp = byId(compId);
  const season = useSeasonFixtures(comp ?? { id: 'none', source: 'espn' });
  const seenTies = usePrefs(s => s.seenTies);
  const markTiesSeen = usePrefs(s => s.markTiesSeen);
  const followedIds = new Set(Object.keys(usePrefs(s => s.followed)));

  const ties = useMemo(() => {
    const fixtures = season.data?.fixtures ?? [];
    return fixtures.filter(f => f.round === round)
      .slice()
      .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  }, [season.data, round]);

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
    <Ceremony key={`${compId}:${round}`} comp={comp} compId={compId} round={round}
      ties={ties} alreadySeen={alreadySeen} markTiesSeen={markTiesSeen} followedIds={followedIds} />
  );
}
