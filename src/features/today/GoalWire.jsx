// The goal wire (spec §13.44, T-A): under the LIVE rule, one hairline-bound
// line carrying the day's latest goals, crossfading between them — never a
// scrolling marquee (the xfade recipe lives inside the motion block, so
// reduced motion gets a clean cut; rotation is content change, not chrome).
// Exists only while matches are live AND at least one goal has been scored;
// clears itself by absence, like the classified. Scorer prints only when
// the feed has named one — the wire never guesses.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { surnameOf } from '../../ui/FixtureRow.jsx';

const ROTATE_MS = 6000;
const POOL_CAP = 6;

// Real-time ordering across simultaneous matches: a 2′ goal in the evening
// kickoff is newer than a 60′ goal in the afternoon one.
const atRealTime = (fixture, goal) =>
  new Date(fixture.kickoff).getTime() + (goal.clockValue ?? 0) * 1000;

export function poolGoals(fixtures) {
  return (fixtures ?? [])
    .filter(f => f?.status === 'live')
    .flatMap(f => (f.goals ?? []).map(goal => ({ fixture: f, goal })))
    .sort((a, b) => atRealTime(b.fixture, b.goal) - atRealTime(a.fixture, a.goal))
    .slice(0, POOL_CAP);
}

const prime = m => (m ?? '').replace(/'/g, '′');

export default function GoalWire({ fixtures, mode = 'line' }) {
  const pool = poolGoals(fixtures);
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (pool.length < 2) return undefined;
    const t = setInterval(() => setAt(v => (v + 1) % pool.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [pool.length]);
  if (pool.length === 0) return null;
  // The stack (T-B, the wire's second form): the latest goals as quiet
  // rows, newest first, capped at four - no timers, the poll is the pulse.
  if (mode === 'stack') {
    return (
      <div className="mb-1">
        {pool.slice(0, 4).map(({ fixture, goal }, i) => (
          <Link key={`${fixture.id}-${goal.clockValue}-${i}`} data-testid="wire-row"
            to={`/match/${fixture.compId}/${fixture.id}`}
            className="flex items-baseline gap-2 py-1.5 border-b border-rule/70">
            <span className="font-sans text-[8.5px] tracking-[.16em] text-accent font-semibold shrink-0 w-9">GOAL</span>
            <span className="font-sans text-[10px] text-muted tabular-nums shrink-0 w-8">{prime(goal.minute)}</span>
            <span className="text-[12.5px] truncate flex-1 min-w-0">
              {`${fixture.home.name} ${fixture.home.score} ${fixture.away.name} ${fixture.away.score}`}
            </span>
            {goal.scorer && (
              <span className="font-sans text-[10px] text-muted shrink-0">{surnameOf(goal.scorer)}</span>
            )}
          </Link>
        ))}
      </div>
    );
  }
  const { fixture, goal } = pool[at % pool.length];
  const line = `${fixture.home.name} ${fixture.home.score} ${fixture.away.name} ${fixture.away.score}`;
  const who = goal.scorer ? `${surnameOf(goal.scorer)} ${prime(goal.minute)}` : prime(goal.minute);
  return (
    <Link to={`/match/${fixture.compId}/${fixture.id}`}
      className="flex items-baseline gap-2 py-2 border-b border-rule">
      {/* keyed on the pool index so each rotation re-enters on the xfade */}
      <span key={at} className="xfade-in flex items-baseline gap-2 flex-1 min-w-0">
        <span className="font-sans text-[8.5px] tracking-[.16em] text-accent font-semibold shrink-0">GOAL</span>
        <span className="text-[12.5px] truncate">{line}</span>
        <span className="font-sans text-[10px] text-muted tabular-nums shrink-0">{who}</span>
      </span>
      {pool.length > 1 && (
        <span className="flex gap-1 items-center shrink-0" aria-hidden>
          {pool.map((_, i) => (
            <i key={i} data-testid="wire-dot"
              className={`w-[3px] h-[3px] rounded-full ${i === at ? 'bg-accent' : 'bg-rule'}`} />
          ))}
        </span>
      )}
    </Link>
  );
}
