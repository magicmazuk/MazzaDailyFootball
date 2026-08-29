// The classified (spec §13.43) — the five o'clock edition. When the day's
// card has settled (17:00 London, three full-times across the desks) Today
// re-leads with the day in one dense broadsheet block: results per comp,
// the headline tables with today's movement, the stakes line, and tonight's
// airtime foot. Present only when earned, gone by morning — most hours of
// most days this renders null.
//
// Self-contained like Papers for the one thing it can fetch itself (the
// airtime schedule); fixtures and tables arrive as props from TodayScreen,
// which already assembles them — never refetched here. All the arithmetic
// is domain law (edition.js): this file only prints what the law settles.
import { Link } from 'react-router-dom';
import { useUpcomingBroadcasts } from '../../data/queries.js';
import {
  editionState, movement, stakesLine, todaysCard, tonightsAirtime,
} from '../../domain/edition.js';

// The two headline tables of the edition — the same pair Quick view keeps.
const TABLE_IDS = ['sco.1', 'eng.1'];

// The paper's dateline is pinned to London like the settled law itself.
const londonLongDate = d => d.toLocaleDateString('en-GB', {
  timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long',
});

const stopPress = n => (n === 1
  ? 'One match in play — result in a later edition.'
  : `${n} in play — results in a later edition.`);

// The m-sec style comp label — bordered in ink, shared by the results
// blocks and the tables. Given a compId it becomes a door to the
// competition page (user note, 2026-08-30): same recipe, now tappable.
function CompLabel({ children, compId = null }) {
  const cls = 'block font-sans text-[9px] tracking-[.18em] uppercase text-muted border-b border-ink pb-1 mb-1';
  if (compId == null) return <p className={cls}>{children}</p>;
  return <Link to={`/competition/${compId}`} className={cls}>{children}</Link>;
}

// A dense classified row: names and bare scores, the whole line a door to
// the match page — scorers live one tap away where §13.42 tells the story.
function ResultRow({ compId, fixture: f }) {
  return (
    <Link to={`/match/${compId}/${f.id}`}
      className="flex items-baseline gap-2 border-b border-rule/70 py-1.5 text-[13px]">
      <span className="flex-1 min-w-0 truncate">{f.home.name}</span>
      <span className="tabular-nums">{f.home.score}</span>
      <span className="flex-1 min-w-0 truncate">{f.away.name}</span>
      <span className="tabular-nums">{f.away.score}</span>
    </Link>
  );
}

// Postponed prints as a result line, muted — a fact of the card, not a door.
function PostponedRow({ fixture: f }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-rule/70 py-1.5 text-[13px] text-muted">
      <span className="flex-1 min-w-0 truncate">{f.home.name}</span>
      <span>P–P</span>
      <span className="flex-1 min-w-0 truncate">{f.away.name}</span>
    </div>
  );
}

// ▲n climbed (ink), ▼n fell (muted), — held or debuted (rule tone — a null
// delta is a team with no before-position, honestly a dash, never a number).
function MovementMark({ delta }) {
  const mark = delta > 0 ? { text: `▲${delta}`, tone: 'text-ink' }
    : delta < 0 ? { text: `▼${-delta}`, tone: 'text-muted' }
      : { text: '—', tone: 'text-rule' };
  return (
    <span className={`w-6 font-sans text-[9px] tabular-nums ${mark.tone}`}>{mark.text}</span>
  );
}

function TableRow({ r, delta, followedIds }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="w-4 font-sans text-[10px] text-muted tabular-nums">{r.position}</span>
      <MovementMark delta={delta} />
      <span className="flex-1 min-w-0 truncate text-[13px]">
        {r.name}
        {followedIds.has(r.teamId)
          && <span className="text-accent text-[9px] align-middle ml-1">★</span>}
      </span>
      <span className="text-[13px] tabular-nums">{r.points}</span>
    </div>
  );
}

// Top four plus any followed club below 4th — the MiniTable precedent.
function EditionTable({ comp, rows, deltas, followedIds }) {
  const top = rows.slice(0, 4);
  const followedBelow = rows.filter(r => r.position > 4 && followedIds.has(r.teamId));
  return (
    <div className="mt-3 first:mt-0">
      <CompLabel compId={comp.id}>{comp.shortName}</CompLabel>
      {top.map(r => <TableRow key={r.teamId} r={r} delta={deltas.get(r.teamId)} followedIds={followedIds} />)}
      {followedBelow.length > 0
        && <p className="text-muted text-center leading-none py-1" aria-hidden>⋯</p>}
      {followedBelow.map(r => (
        <TableRow key={r.teamId} r={r} delta={deltas.get(r.teamId)} followedIds={followedIds} />
      ))}
    </div>
  );
}

export default function Classified({ fixturesByComp, tables, followedIds = new Set(), now = new Date() }) {
  // The one fetch of its own — called before the settled-law gate, as
  // hooks must be. Everything below the gate is pure print.
  const broadcasts = useUpcomingBroadcasts();
  const state = editionState(fixturesByComp, now);
  if (state == null) return null;

  const nowDate = now instanceof Date ? now : new Date(now);
  const inPlay = state.inPlay.length;

  // The desk order (user note, 2026-08-30): the two headline leagues lead
  // the classified - Premiership then Premier League - before the lower
  // desks in their registry order.
  const HEADLINERS = ['sco.1', 'eng.1'];
  const results = [
    ...HEADLINERS.flatMap(id => state.results.filter(r => r.comp.id === id)),
    ...state.results.filter(r => !HEADLINERS.includes(r.comp.id)),
  ];

  // The headline tables: only a comp whose official rows exist AND that
  // put at least one full-time on today's card gets a movement table.
  const tableBlocks = TABLE_IDS.flatMap(id => {
    const rows = tables?.[id];
    const entry = (fixturesByComp ?? []).find(e => e?.comp?.id === id);
    if (!rows?.length || entry == null) return [];
    if (!state.results.some(r => r.comp.id === id)) return [];
    const allFt = (entry.fixtures ?? []).filter(f => f?.status === 'ft');
    const deltas = movement(allFt, todaysCard(allFt, now));
    return [{ comp: entry.comp, rows, deltas }];
  });

  // The stakes line speaks for the first followed club across the headline
  // tables, best league first — stakesLine itself refuses anything the
  // capped copy set cannot state honestly.
  const stakes = TABLE_IDS.map(id => stakesLine(tables?.[id], followedIds)).find(Boolean) ?? null;

  // The airtime foot: first airing per show only — upcoming.json lists
  // every repeat, and the foot is a listing, not a schedule.
  const airings = tonightsAirtime(broadcasts, now);
  const seen = new Set();
  const foot = airings?.filter(a => !seen.has(a.show) && seen.add(a.show)) ?? null;

  return (
    <section className="mt-8">
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-accent">
        The Five O&apos;Clock Edition
      </p>
      <h2 className="text-[21px] mt-1">The Classified</h2>
      <p className="font-sans text-[9.5px] uppercase tracking-[.14em] text-muted mt-1.5">
        {londonLongDate(nowDate)} · {inPlay === 0
          ? 'full time across the card'
          : `results so far — ${inPlay} in play`}
      </p>
      {results.map(({ comp, fixtures }) => (
        <div key={comp.id} className="mt-5">
          <CompLabel compId={comp.id}>{comp.shortName}</CompLabel>
          {fixtures.map(f => <ResultRow key={f.id} compId={comp.id} fixture={f} />)}
        </div>
      ))}
      {state.postponed.length > 0 && (
        <div className="mt-2">
          {state.postponed.map(f => <PostponedRow key={f.id} fixture={f} />)}
        </div>
      )}
      {inPlay > 0 && (
        <p className="text-[12.5px] italic text-muted mt-3">{stopPress(inPlay)}</p>
      )}
      {tableBlocks.length > 0 && (
        <div className="mt-6">
          <p className="font-sans text-[9px] uppercase tracking-[.18em] text-muted mb-2">
            as it stands · today&apos;s movement
          </p>
          {tableBlocks.map(b => (
            <EditionTable key={b.comp.id} comp={b.comp} rows={b.rows}
              deltas={b.deltas} followedIds={followedIds} />
          ))}
        </div>
      )}
      {stakes && (
        <p className="text-[12.5px] border-l-2 border-accent pl-2.5 mt-5">{stakes}</p>
      )}
      {foot != null && foot.length > 0 && (
        <p className="font-sans text-[9.5px] uppercase tracking-[.14em] text-muted border-t border-rule pt-2 mt-6">
          Tonight — {foot.map(a => [a.show, a.timeLabel, a.channel].filter(Boolean).join(' · ')).join(' / ')}
        </p>
      )}
    </section>
  );
}
