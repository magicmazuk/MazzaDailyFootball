import SectionLabel from '../../ui/SectionLabel.jsx';
import FixtureRow from '../../ui/FixtureRow.jsx';

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

export default function TodayView({ partition, followedIds, date, asOf = null }) {
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
      <Section label="★ Your clubs" fixtures={yours} followedIds={followedIds} />
      <Section label="Live" fixtures={live} followedIds={followedIds} />
      <Section label="Later today" muted fixtures={later} followedIds={followedIds} />
      <Section label="Earlier today" muted fixtures={earlier} followedIds={followedIds} />
      {quiet && <p className="text-muted mt-2">No matches today.</p>}
      <Section label="Yesterday" muted fixtures={yesterday} followedIds={followedIds} />
    </main>
  );
}
