// The archive editions (spec §13.48): any settled day's classified, from
// the calendar — the same envelope, the same broadcast, the same
// announcer, replayed for a past card. Results only: the movement tables,
// stakes and airtime are TODAY's arithmetic and would lie about a past
// day, so the archive prints the edition AS READ. No prefs memory — a
// ritual, not a reveal.
import { useParams, Link } from 'react-router-dom';
import { COMPETITIONS } from '../../domain/competitions.js';
import { useAllSeasonFixtures } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import Classified from './Classified.jsx';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default function ClassifiedArchive() {
  const { day } = useParams();
  const hidden = usePrefs(s => s.hiddenComps);
  const followed = usePrefs(s => s.followed);
  const comps = COMPETITIONS.filter(c => !hidden.includes(c.id));
  const seasons = useAllSeasonFixtures(comps);
  if (!DAY.test(day ?? '')) return <p className="text-muted">Unknown edition.</p>;
  const fixturesByComp = comps
    .map((comp, i) => ({ comp, fixtures: seasons[i]?.data?.fixtures ?? [] }))
    .filter(e => e.fixtures.length > 0);
  // 17:30Z is past five London in BST and GMT alike — the settled law
  // holds for any archive day without caring about the clock's season.
  const now = new Date(`${day}T17:30:00Z`);
  const label = now.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long',
  });
  return (
    <main>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-muted">
        <Link to="/calendar">The archive</Link>
      </p>
      <h1 className="text-[25px] mb-2">{label}</h1>
      <div className="rise-in rise-in-1">
        <Classified archive fixturesByComp={fixturesByComp} tables={{}}
          followedIds={new Set(Object.keys(followed))} now={now} />
      </div>
    </main>
  );
}
