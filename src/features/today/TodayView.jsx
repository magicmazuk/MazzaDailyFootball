import SectionLabel from '../../ui/SectionLabel.jsx';
import FixtureRow from '../../ui/FixtureRow.jsx';
import NextUpRow from './NextUpRow.jsx';
import MiniTable from './MiniTable.jsx';

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

function Section({ label, muted, fixtures, followedIds }) {
  if (!fixtures.length) return null;
  return (
    <section className="mt-8 first:mt-0">
      <SectionLabel muted={muted}>{label}</SectionLabel>
      {fixtures.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} />)}
    </section>
  );
}

export default function TodayView({ partition, followedIds, date, asOf = null, nextUp = [], onTv = [], quickTables = [] }) {
  const { yours, live, later, earlier, yesterday } = partition;
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
      {(yours.length > 0 || nextUp.length > 0) && (
        <section className="mt-8 first:mt-0">
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
      <Section label="Live" fixtures={live} followedIds={followedIds} />
      <Section label="Later today" muted fixtures={later} followedIds={followedIds} />
      <Section label="Earlier today" muted fixtures={earlier} followedIds={followedIds} />
      {onTv.length > 0 && (
        <section className="mt-8">
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
        <section className="mt-8">
          <SectionLabel muted>Quick view</SectionLabel>
          {quickTables.map(q => (
            <MiniTable key={q.comp.id} comp={q.comp} rows={q.rows} followedIds={followedIds} />
          ))}
        </section>
      )}
      {quiet && <p className="text-muted mt-2">No matches today.</p>}
      <Section label="Yesterday" muted fixtures={yesterday} followedIds={followedIds} />
    </main>
  );
}
