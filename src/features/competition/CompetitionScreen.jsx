import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { byId } from '../../domain/competitions.js';
import { formGuide } from '../../domain/form.js';
import { useSeasonFixtures, useTable } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import FixtureRow from '../../ui/FixtureRow.jsx';
import LeagueTable from './LeagueTable.jsx';
import StructureStrip from './StructureStrip.jsx';
import FieldBoard from './FieldBoard.jsx';
import { groupFixturesByRound } from './roundGroups.js';

// One date sub-group's fixtures, unchanged from before round-grouping
// existed — same day label style, same rows, `showContext={false}` since
// the page itself is the context (spec §13.12).
function DateGroup({ day, list, followedIds }) {
  return (
    <>
      <p className="font-sans text-[9.5px] uppercase tracking-[.18em] text-muted mb-2">{day}</p>
      {list.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} showContext={false} />)}
    </>
  );
}

// Fixtures/Results tab body (Release 2.3 §C1): once at least one fixture
// carries a displayable round, groups by round first — a primary heading
// per round (matching the FieldBoard/day-list primary-heading pattern),
// each with its date sub-grouping nested inside. A league never has a
// displayable round (groupFixturesByRound returns a single null-round/
// null-label group for it), so it renders exactly as it did before: flat
// `<section>` per date, no round heading, no extra wrapper element.
function GroupedFixtures({ fixtures, reverse, followedIds }) {
  return groupFixturesByRound(fixtures, { reverse }).map(group => (group.label
    ? (
      <section key={group.label} className="mb-8">
        <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[.2em] text-accent
                       pb-2 mb-2 border-b border-ink">
          {group.label}
        </h2>
        {group.days.map(([day, list]) => (
          <div key={day} className="mb-6 last:mb-0">
            <DateGroup day={day} list={list} followedIds={followedIds} />
          </div>
        ))}
      </section>
    )
    : group.days.map(([day, list]) => (
      <section key={day} className="mb-6">
        <DateGroup day={day} list={list} followedIds={followedIds} />
      </section>
    ))));
}

export default function CompetitionScreen() {
  const { compId } = useParams();
  const comp = byId(compId);
  // Cups (spec §13.10) lead with Overview; the three hasTable cups (the
  // European competitions) also carry a Table tab. Leagues are unchanged.
  const tabs = comp?.type === 'cup'
    ? ['Overview', ...(comp.hasTable ? ['Table'] : []), 'Fixtures', 'Results']
    : [...(comp?.hasTable ? ['Table'] : []), 'Fixtures', 'Results'];
  const [tab, setTab] = useState(tabs[0]);
  // React Router reuses this component instance across param changes on
  // the same route (`competition/:compId`) rather than remounting it, so
  // `tab` can be left over from a previous, differently-tabbed competition
  // (e.g. 'Table' after leaving a league for a cup with no Table tab) —
  // fall back to the new competition's first tab whenever the stored one
  // isn't valid for it, without needing a remount/key trick.
  const active = tabs.includes(tab) ? tab : tabs[0];
  const followedIds = new Set(Object.keys(usePrefs(s => s.followed)));
  const table = useTable(comp ?? { id: 'none', hasTable: false, source: 'espn' });
  const season = useSeasonFixtures(comp ?? { id: 'none', source: 'espn' });

  const formByTeam = useMemo(() => {
    const fixtures = table.data?.fixtures ?? [];
    const map = {};
    for (const r of table.data?.rows ?? []) map[r.teamId] = formGuide(fixtures, r.teamId);
    return map;
  }, [table.data]);

  if (!comp) return <p className="text-muted">Unknown competition.</p>;
  const fixtures = season.data?.fixtures ?? [];
  const upcoming = fixtures.filter(f => ['scheduled', 'live', 'postponed'].includes(f.status))
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const results = fixtures.filter(f => f.status === 'ft')
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff));

  return (
    <main>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-muted">{comp.country}</p>
      <h1 className="text-[25px] mb-6">{comp.name}</h1>
      <div className="flex border border-ink rounded-sm overflow-hidden mb-6 font-sans">
        {tabs.map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[9.5px] uppercase tracking-[.1em] ${
              active === t ? 'bg-ink text-paper' : 'text-ink'}`}>
            {t}
          </button>
        ))}
      </div>
      {active === 'Overview' && (
        <>
          <StructureStrip structure={comp.structure} />
          {season.isLoading
            ? <p className="text-muted">Loading the field…</p>
            : <FieldBoard fixtures={fixtures} comp={comp} followedIds={followedIds} />}
        </>
      )}
      {active === 'Table' && (table.data
        ? <LeagueTable comp={comp} rows={table.data.rows}
            followedIds={followedIds} formByTeam={formByTeam} />
        : <p className="text-muted">{table.isError ? 'Table unavailable.' : 'Loading table…'}</p>)}
      {active === 'Fixtures' && (
        <GroupedFixtures fixtures={upcoming} reverse={false} followedIds={followedIds} />
      )}
      {active === 'Results' && (
        <GroupedFixtures fixtures={results} reverse followedIds={followedIds} />
      )}
    </main>
  );
}
