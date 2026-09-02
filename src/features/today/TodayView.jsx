import SectionLabel from '../../ui/SectionLabel.jsx';
import FixtureRow from '../../ui/FixtureRow.jsx';
import NextUpRow from './NextUpRow.jsx';
import MiniTable from './MiniTable.jsx';
import DrawInvitation from './DrawInvitation.jsx';
import Papers from './Papers.jsx';
import GoalWire, { poolGoals } from './GoalWire.jsx';
import { usePrefs } from '../../store/prefs.js';

// The wire's two forms, one hairline toggle on the Live rule (spec 13.44
// addendum): the revolving line or the stacked latest goals - drawn as
// tiny bar glyphs, the active one in ink, the choice persisted.
function WireModeToggle({ mode, onToggle }) {
  const glyph = (bars, active, label) => (
    <button key={label} type="button" aria-label={label} aria-pressed={active}
      onClick={active ? undefined : onToggle}
      className="p-1 -m-0.5 flex flex-col gap-[2px] items-stretch w-[18px]">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className={`block h-[2px] rounded-sm ${active ? 'bg-ink' : 'bg-rule'}`} />
      ))}
    </button>
  );
  return (
    <span className="flex gap-1.5 items-center normal-case tracking-normal">
      {glyph(1, mode === 'line', 'The revolving line')}
      {glyph(3, mode === 'stack', 'The goal stack')}
    </span>
  );
}
import HighlightsReel from './HighlightsReel.jsx';

const longDate = d => d.toLocaleDateString('en-GB',
  { weekday: 'long', day: 'numeric', month: 'long' });

const groupOnTvByDay = fixtures => {
  const groups = new Map();
  for (const f of fixtures) {
    const day = new Date(f.kickoff).toLocaleDateString('en-GB',
      { weekday: 'short', day: 'numeric', month: 'short' });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(f);
  }
  return [...groups.entries()];
};

// riseIn (spec §13.21): a static "rise-in rise-in-N" string, or undefined
// for sections that don't take part in the arrival choreography (today,
// just Yesterday) — assigned per NAMED slot, not by this section's runtime
// position among its visible siblings, so a section always rises with the
// same delay regardless of which of its neighbours happen to be absent.
function Section({ label, muted, fixtures, followedIds, riseIn, lead = null, labelRight = null, leadStands = false }) {
  // leadStands (§13.44 correction): a section whose LEAD has something to
  // say renders even with no rows of its own — the lone live favourite's
  // wire, whose fixture row lives up in Your clubs.
  if (!fixtures.length && !leadStands) return null;
  return (
    <section className={`mt-8 first:mt-0 ${riseIn ?? ''}`}>
      <SectionLabel muted={muted} right={labelRight}>{label}</SectionLabel>
      {lead}
      {fixtures.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} />)}
    </section>
  );
}

export default function TodayView({ partition, followedIds, date, asOf = null, nextUp = [], onTv = [], quickTables = [], draws = [], phaseDraws = [], classified = null }) {
  const goalWireMode = usePrefs(s => s.goalWireMode);
  const toggleGoalWireMode = usePrefs(s => s.toggleGoalWireMode);
  const { yours, live, later, earlier, yesterday } = partition;
  // §13.44 correction (user report, 2026-09-02: Celtic 3-0 and the wire
  // silent): the partition pulls favourites into Your clubs before the
  // live list, so a wire fed only `live` never saw a followed club's
  // goals. Favourites prioritise, never hide — the POOL reads every
  // live fixture; the section's rows stay the neutral ones.
  const liveAll = [...yours.filter(f => f.status === 'live'), ...live];
  const quiet = !yours.length && !live.length && !later.length && !earlier.length;
  return (
    <main>
      <p className="font-sans text-[11px] uppercase tracking-[.22em] text-muted">
        {longDate(date)}
      </p>
      <h1 className="text-[27px] mb-8">Today</h1>
      {asOf && (
        <p className="font-sans text-[10px] text-muted mb-6">
          as of {new Date(asOf).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {draws.map(d => <DrawInvitation key={`${d.comp.id}:${d.round}`} draw={d} />)}
      {phaseDraws.map(d => (
        <DrawInvitation key={`${d.comp.id}:${d.round}:${d.club.teamId}`} draw={d} />
      ))}
      {/* The classified (spec §13.43) — the five o'clock edition IS the
          lead when present, so it takes the invitation slot's position
          (after the draws, before Your clubs) rather than a new named
          rise-in slot. Wrapped like Papers/HighlightsReel: the element
          owns its own <section> and gates itself; a null prop adds
          nothing at all. */}
      {/* THE LIVE LEAD (spec 13.46): while the ball is moving, live IS the
          front page - it outranks the classified and Your clubs whenever
          it exists. Its named rise-in slot stays 2 (13.21: a section keeps
          its delay regardless of neighbours). The goal wire (13.44) rides
          as its lead; the toggle lives on the rule. */}
      <Section label="Live" fixtures={live} followedIds={followedIds} riseIn="rise-in rise-in-2"
        labelRight={<WireModeToggle mode={goalWireMode} onToggle={toggleGoalWireMode} />}
        leadStands={poolGoals(liveAll).length > 0}
        lead={<GoalWire fixtures={liveAll} mode={goalWireMode} />} />
      {classified && <div className="rise-in rise-in-1">{classified}</div>}
      {(yours.length > 0 || nextUp.length > 0) && (
        <section className="mt-8 first:mt-0 rise-in rise-in-1">
          <SectionLabel>★ Your clubs</SectionLabel>
          {yours.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} />)}
          {nextUp.length > 0 && (
            <div className="mt-1">
              <p className="font-sans text-[9px] uppercase tracking-[.18em] text-muted mt-3 mb-1">
                Next up
              </p>
              {nextUp.map(x => <NextUpRow key={x.club.id} club={x.club} fixture={x.fixture} />)}
            </div>
          )}
        </section>
      )}
      <Section label="Later today" muted fixtures={later} followedIds={followedIds} riseIn="rise-in rise-in-3" />
      <Section label="Earlier today" muted fixtures={earlier} followedIds={followedIds} riseIn="rise-in rise-in-4" />
      {quiet && <p className="text-muted mt-2">No matches today.</p>}
      {/* The highlights reel (spec §13.36) owns its own <section> like
          Papers — wrapped, not touched, for the same rise-in reason; it
          renders nothing at all when no episode is fresh. */}
      <div className="rise-in rise-in-5">
        <HighlightsReel />
      </div>
      {/* Papers owns its own <section> internally (task 2) — wrapped here
          rather than touched directly, so the rise-in slot stays a purely
          section-level, page-owned concern (spec §13.21). */}
      <div className="rise-in rise-in-5">
        <Papers />
      </div>
      {onTv.length > 0 && (
        <section className="mt-8 rise-in rise-in-5">
          <SectionLabel muted>On TV</SectionLabel>
          {groupOnTvByDay(onTv).map(([day, list]) => (
            <div key={day} className="mb-4">
              <p className="font-sans text-[9.5px] uppercase tracking-[.18em] text-muted mb-1">{day}</p>
              {list.map(f => <FixtureRow key={`${f.compId}-${f.id}`} fixture={f} followedIds={followedIds} />)}
            </div>
          ))}
        </section>
      )}
      {quickTables.some(q => q.rows?.length) && (
        <section className="mt-8 rise-in rise-in-5">
          <SectionLabel muted>Quick view</SectionLabel>
          {quickTables.map(q => (
            <MiniTable key={q.comp.id} comp={q.comp} rows={q.rows} followedIds={followedIds} />
          ))}
        </section>
      )}
      <Section label="Yesterday" muted fixtures={yesterday} followedIds={followedIds} />
    </main>
  );
}
