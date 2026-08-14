import SectionLabel from '../../ui/SectionLabel.jsx';
import FixtureRow from '../../ui/FixtureRow.jsx';
import NextUpRow from './NextUpRow.jsx';

const longDate = d => d.toLocaleDateString('en-GB',
  { weekday: 'long', day: 'numeric', month: 'long' });

function Section({ label, muted, fixtures, followedIds }) {
  if (!fixtures.length) return null;
  return (
    <section className="mt-8 first:mt-0">
      <SectionLabel muted={muted}>{label}</SectionLabel>
      {fixtures.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} />)}
    </section>
  );
}

export default function TodayView({ partition, followedIds, date, asOf = null, nextUp = [] }) {
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
      {quiet && <p className="text-muted mt-2">No matches today.</p>}
      <Section label="Yesterday" muted fixtures={yesterday} followedIds={followedIds} />
    </main>
  );
}
