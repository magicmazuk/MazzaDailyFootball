// The goal wire (spec §13.44, both forms): under the LIVE rule, the day's
// latest goals — the revolving line (T-A, crossfading, never a marquee) or
// the stack (T-B, latest four as quiet rows). Data rides the front page's
// existing poll (30s while live); this component adds only the theatre:
// a NEW goal arrives on the goalflash, the least-recent fades out with
// wire-leave, removed on a TIMER — never on animationend, which jsdom and
// reduced-motion both make a promise that cannot fire. The initial render
// never flashes: opening the paper is not a goal. Scorer prints only when
// the feed has named one — the wire never guesses.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { surnameOf } from '../../ui/FixtureRow.jsx';

const ROTATE_MS = 6000;
const POOL_CAP = 6;
const STACK_CAP = 4;
const LEAVE_MS = 500;

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

const keyOf = ({ fixture, goal }) =>
  `${fixture.id}:${goal.clockValue}:${goal.teamId}`;

const prime = m => (m ?? '').replace(/'/g, '′');

const scoreline = f => `${f.home.name} ${f.home.score} ${f.away.name} ${f.away.score}`;

function StackRow({ entry, phase }) {
  const { fixture, goal } = entry;
  const tone = phase === 'fresh' ? ' wire-flash' : phase === 'leave' ? ' wire-leave' : '';
  return (
    <Link data-testid="wire-row" to={`/match/${fixture.compId}/${fixture.id}`}
      className={`flex items-baseline gap-2 py-1.5 border-b border-rule/70${tone}`}>
      <span className="font-sans text-[8.5px] tracking-[.16em] text-accent font-semibold shrink-0 w-9">GOAL</span>
      <span className="font-sans text-[10px] text-muted tabular-nums shrink-0 w-8">{prime(goal.minute)}</span>
      <span className="text-[12.5px] truncate flex-1 min-w-0">{scoreline(fixture)}</span>
      {goal.scorer && (
        <span className="font-sans text-[10px] text-muted shrink-0">{surnameOf(goal.scorer)}</span>
      )}
    </Link>
  );
}

export default function GoalWire({ fixtures, mode = 'line' }) {
  const pool = poolGoals(fixtures);
  const poolKeys = pool.map(keyOf).join('|');
  const [at, setAt] = useState(0);
  const [leaving, setLeaving] = useState([]);
  // The flash is STATE, not a render diff: the arrival effect's own
  // re-render would wipe a class derived from "keys I hadn't seen last
  // render". A short-lived key survives the churn, timer-cleared.
  const [flashKey, setFlashKey] = useState(null);
  // Previous pool, for the arrival/departure diff. Seeded on the first
  // render so opening the paper mid-match never flashes.
  const prevRef = useRef(null);

  useEffect(() => {
    const before = prevRef.current;
    const nowKeys = new Set(pool.map(keyOf));
    const visible = pool.slice(0, STACK_CAP);
    prevRef.current = { keys: nowKeys, visible };
    if (before == null) return undefined;
    const timers = [];
    const arrivals = pool.filter(e => !before.keys.has(keyOf(e)));
    if (arrivals.length > 0) {
      setAt(0); // a new goal seizes the line
      setFlashKey(keyOf(arrivals[0]));
      timers.push(setTimeout(() => setFlashKey(null), 1000));
    }
    const dropped = before.visible.filter(e => !visible.some(v => keyOf(v) === keyOf(e)));
    if (dropped.length > 0) {
      setLeaving(l => [...l, ...dropped].slice(-2));
      timers.push(setTimeout(() => setLeaving([]), LEAVE_MS));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKeys]);

  useEffect(() => {
    if (mode !== 'line' || pool.length < 2) return undefined;
    const t = setInterval(() => setAt(v => (v + 1) % pool.length), ROTATE_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pool.length]);

  if (pool.length === 0 && leaving.length === 0) return null;

  // The stack (T-B): the latest goals as quiet rows — arrivals flash,
  // the row pushed off the foot fades out beneath them.
  if (mode === 'stack') {
    const visible = pool.slice(0, STACK_CAP);
    return (
      <div className="mb-1">
        {visible.map(entry => (
          <StackRow key={keyOf(entry)} entry={entry}
            phase={flashKey === keyOf(entry) ? 'fresh' : null} />
        ))}
        {leaving.map(entry => (
          <StackRow key={`leave-${keyOf(entry)}`} entry={entry} phase="leave" />
        ))}
      </div>
    );
  }

  // The revolving line (T-A).
  if (pool.length === 0) return null;
  const current = pool[at % pool.length];
  const { fixture, goal } = current;
  const fresh = flashKey === keyOf(current);
  const who = goal.scorer ? `${surnameOf(goal.scorer)} ${prime(goal.minute)}` : prime(goal.minute);
  return (
    <Link to={`/match/${fixture.compId}/${fixture.id}`}
      className="flex items-baseline gap-2 py-2 border-b border-rule">
      {/* keyed per goal+rotation so each change re-enters on its animation:
          the goalflash for a new goal, the plain crossfade for rotation. */}
      <span key={`${keyOf(current)}-${at}`}
        className={`${fresh ? 'wire-flash' : 'xfade-in'} flex items-baseline gap-2 flex-1 min-w-0`}>
        <span className="font-sans text-[8.5px] tracking-[.16em] text-accent font-semibold shrink-0">GOAL</span>
        <span className="text-[12.5px] truncate">{scoreline(fixture)}</span>
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
