import { Link } from 'react-router-dom';
import SectionLabel from '../../ui/SectionLabel.jsx';
import FixtureRow from '../../ui/FixtureRow.jsx';
import NextUpRow from './NextUpRow.jsx';
import MiniTable from './MiniTable.jsx';
import Crest from '../../ui/Crest.jsx';

const longDate = d => d.toLocaleDateString('en-GB',
  { weekday: 'long', day: 'numeric', month: 'long' });

function CalendarGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden className="text-muted">
      <rect x="0.5" y="1.5" width="11" height="10" rx="1" fill="none"
        stroke="currentColor" strokeWidth="1" />
      <line x1="0.5" y1="4.5" x2="11.5" y2="4.5" stroke="currentColor" strokeWidth="1" />
      <line x1="3.5" y1="0.5" x2="3.5" y2="2.5" stroke="currentColor" strokeWidth="1" />
      <line x1="8.5" y1="0.5" x2="8.5" y2="2.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function Section({ label, muted, fixtures, followedIds }) {
  if (!fixtures.length) return null;
  return (
    <section className="mt-8 first:mt-0">
      <SectionLabel muted={muted}>{label}</SectionLabel>
      {fixtures.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} />)}
    </section>
  );
}

export default function TodayView({ partition, followedIds, date, asOf = null, nextUp = [], quickTables = [], followedClubs = [] }) {
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
      {(yours.length > 0 || nextUp.length > 0 || followedClubs.length > 0) && (
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
          {followedClubs.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3.5">
              {followedClubs.map(club => (
                <Link key={club.id} to={`/calendar/${club.id}`} aria-label={`${club.name} calendar`}
                  className="inline-flex items-center gap-1.5 border border-rule rounded-full
                             pl-1.5 pr-2 py-1">
                  <Crest side={club} size={16} />
                  <CalendarGlyph />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
      <Section label="Live" fixtures={live} followedIds={followedIds} />
      <Section label="Later today" muted fixtures={later} followedIds={followedIds} />
      <Section label="Earlier today" muted fixtures={earlier} followedIds={followedIds} />
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
