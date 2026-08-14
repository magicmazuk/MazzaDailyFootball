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

const groupByDate = fixtures => {
  const groups = new Map();
  for (const f of fixtures) {
    const day = new Date(f.kickoff).toLocaleDateString('en-GB',
      { weekday: 'short', day: 'numeric', month: 'short' });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(f);
  }
  return [...groups.entries()];
};

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
      {active === 'Fixtures' && groupByDate(upcoming).map(([day, list]) => (
        <section key={day} className="mb-6">
          <p className="font-sans text-[9.5px] uppercase tracking-[.18em] text-muted mb-2">{day}</p>
          {list.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} />)}
        </section>
      ))}
      {active === 'Results' && groupByDate(results).map(([day, list]) => (
        <section key={day} className="mb-6">
          <p className="font-sans text-[9.5px] uppercase tracking-[.18em] text-muted mb-2">{day}</p>
          {list.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} />)}
        </section>
      ))}
    </main>
  );
}
