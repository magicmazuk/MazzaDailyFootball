import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COMPETITIONS } from '../../domain/competitions.js';
import { addMonths, dayKey, fixturesByDay, monthGrid } from '../../domain/calendar.js';
import { useAllSeasonFixtures } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import Crest from '../../ui/Crest.jsx';
import FixtureRow from '../../ui/FixtureRow.jsx';
import MonthGrid from './MonthGrid.jsx';

const MONTH_TITLE = (y, m) =>
  new Date(y, m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export default function CalendarScreen() {
  const { teamId } = useParams();
  const followed = usePrefs(s => s.followed);
  const hidden = usePrefs(s => s.hiddenComps);
  const comps = COMPETITIONS.filter(c => !hidden.includes(c.id));
  const seasons = useAllSeasonFixtures(comps);

  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedKey, setSelectedKey] = useState(dayKey(now));

  // Inlined, not memoized (backlog tidy): useAllSeasonFixtures returns a
  // fresh array every render regardless of whether its data changed, so a
  // useMemo keyed on `seasons` recomputed every render anyway — dead
  // weight, not a real memo.
  const allFixtures = seasons.flatMap(r => r.data?.fixtures ?? []);
  const fixtures = teamId
    ? allFixtures.filter(f => f.home.teamId === teamId || f.away.teamId === teamId)
    : allFixtures;
  const byDay = fixturesByDay(fixtures);

  const club = teamId
    ? followed[teamId]
      ?? (fixtures[0] && (fixtures[0].home.teamId === teamId ? fixtures[0].home : fixtures[0].away))
    : null;
  // The club-link rule (spec §13.2): the header crest+name must link to the
  // team page. Followed club objects carry their own compId; a club derived
  // from a fixture side doesn't, so fall back to that fixture's compId.
  const clubCompId = club?.compId ?? fixtures[0]?.compId ?? 'sco.1';
  const followedIds = new Set(Object.keys(followed));
  const weeks = monthGrid(ym.year, ym.month);
  const dayFixtures = selectedKey ? byDay.get(selectedKey) ?? [] : [];
  const selectedDate = selectedKey ? new Date(`${selectedKey}T12:00:00`) : null;

  // Paging to another month clears the selected day (backlog, spec
  // §13.18.4) — otherwise the day list below keeps showing whichever day
  // was selected in the PREVIOUS month, next to a grid that no longer
  // highlights it at all.
  const pageMonth = delta => {
    setYm(v => addMonths(v, delta));
    setSelectedKey(null);
  };

  return (
    <main>
      {/* Motion (spec §13.21): header (club link or the plain title), the
          month nav + grid, and the selected-day fixture list each rise in
          on mount, one static delay class per slot. */}
      <div className="rise-in rise-in-1">
        <p className="font-sans text-[10px] uppercase tracking-[.22em] text-muted">Calendar</p>
        {club && (
          <Link to={`/team/${clubCompId}/${teamId}`}
            className="flex items-center gap-2.5 mt-1 w-fit">
            <Crest side={club} size={22} />
            <h1 className="text-[22px]">{club.name}</h1>
          </Link>
        )}
        {!club && <h1 className="text-[27px]">Fixtures</h1>}
      </div>

      <div className="rise-in rise-in-2">
        <div className="flex items-baseline justify-between mt-5 mb-4">
          <button type="button" aria-label="Previous month"
            onClick={() => pageMonth(-1)}
            className="font-serif text-[19px] px-2 text-muted">‹</button>
          <h2 className="text-[19px]">{MONTH_TITLE(ym.year, ym.month)}</h2>
          <button type="button" aria-label="Next month"
            onClick={() => pageMonth(1)}
            className="font-serif text-[19px] px-2 text-muted">›</button>
        </div>

        <MonthGrid weeks={weeks} monthIndex={ym.month} byDay={byDay}
          followedIds={followedIds} clubId={teamId ?? null}
          selectedKey={selectedKey} onSelectDay={setSelectedKey} todayKey={dayKey(now)} />
      </div>

      {selectedDate && (
        <section className="mt-7 rise-in rise-in-3">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[.2em] text-accent
                        pb-2 mb-1 border-b border-ink">
            {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {dayFixtures.length === 0 && (
            <p className="text-muted mt-3">No fixtures this day.</p>
          )}
          {dayFixtures.map(f => (
            <FixtureRow key={`${f.compId}-${f.id}`} fixture={f} followedIds={followedIds} />
          ))}
        </section>
      )}
    </main>
  );
}
