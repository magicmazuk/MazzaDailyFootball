// The Competitions front (spec §13.34): a front page, not an index. The
// two headline tables printed in full, the active tournaments' state at a
// glance, the whole list beneath — everything read from caches the app
// already keeps warm (two useTable hooks and the season fixtures Today
// itself fetches); this page adds NO new requests.
import { Link, useNavigate } from 'react-router-dom';
import { COMPETITIONS, COMPETITION_GROUPS, byId } from '../../domain/competitions.js';
import { useAllSeasonFixtures, useTable } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import Crest from '../../ui/Crest.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import { activeSummary } from './summary.js';

const HEADLINERS = ['sco.1', 'eng.1'];
const OTHERS = COMPETITIONS.filter(c => !HEADLINERS.includes(c.id));

// One headline classified: every row in the quick-table recipe, each row
// the road to its club (the v1.8.2 rule), the full apparatus one tap away
// on the competition page. Pre-season reads as the honest one-liner.
function FrontTable({ comp, table, followedIds }) {
  const navigate = useNavigate();
  const rows = table.data?.rows ?? [];
  const preSeason = rows.length > 0 && rows.every(r => r.played === 0);
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between pb-2 mb-1 border-b border-ink">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[.2em] text-accent">
          {comp.shortName}
        </span>
        <Link to={`/competition/${comp.id}`}
          className="font-sans text-[9px] uppercase tracking-[.14em] text-muted">
          Full table →
        </Link>
      </div>
      {rows.length === 0 && (
        <p className="font-sans text-[11px] text-muted">
          {table.isError ? 'Table unavailable.' : 'Loading table…'}
        </p>
      )}
      {preSeason && (
        <p className="font-sans text-[11px] text-muted">The season hasn't kicked off.</p>
      )}
      {!preSeason && rows.map(row => (
        <button key={row.teamId} type="button"
          onClick={() => navigate(`/team/${comp.id}/${row.teamId}`)}
          className="w-full text-left flex items-center gap-2 py-1.5 border-b border-rule/70">
          <span className="w-4 font-sans text-[10px] text-muted tabular-nums shrink-0">
            {row.position}
          </span>
          <Crest side={row} size={18} />
          <span className="flex-1 min-w-0 truncate text-[13px]">
            {row.name}
            {followedIds.has(row.teamId) && (
              <span className="text-accent text-[9px] align-middle ml-1">★</span>
            )}
          </span>
          <span className="text-[13px] tabular-nums">{row.points}</span>
        </button>
      ))}
    </section>
  );
}

export default function CompetitionsScreen() {
  const hidden = usePrefs(s => s.hiddenComps);
  const followedIds = new Set(Object.keys(usePrefs(s => s.followed)));
  const spl = useTable(byId('sco.1'));
  const epl = useTable(byId('eng.1'));
  const seasons = useAllSeasonFixtures(OTHERS);
  const summaries = OTHERS
    .map((comp, i) => ({ comp, summary: activeSummary(seasons[i]?.data?.fixtures) }))
    .filter(({ comp, summary }) => summary && !hidden.includes(comp.id));
  return (
    <main>
      <h1 className="text-[27px] mb-8">Competitions</h1>
      <div className="rise-in rise-in-1">
        <FrontTable comp={byId('sco.1')} table={spl} followedIds={followedIds} />
      </div>
      <div className="rise-in rise-in-2">
        <FrontTable comp={byId('eng.1')} table={epl} followedIds={followedIds} />
      </div>
      {summaries.length > 0 && (
        <section className="mb-8 rise-in rise-in-3">
          <SectionLabel muted>In play elsewhere</SectionLabel>
          {summaries.map(({ comp, summary }) => (
            <Link key={comp.id} to={`/competition/${comp.id}`}
              className="flex items-baseline justify-between gap-3 py-2.5 border-b border-rule/70">
              <span className="text-[14.5px] truncate">{comp.name}</span>
              <span className={`font-sans text-[9.5px] uppercase tracking-[.1em] text-right shrink-0 ${
                summary.live ? 'text-accent' : 'text-muted'}`}>
                {summary.text}
              </span>
            </Link>
          ))}
        </section>
      )}
      {COMPETITION_GROUPS.map(([country, comps], i) => {
        const visible = comps.filter(c => !hidden.includes(c.id) && !HEADLINERS.includes(c.id));
        if (!visible.length) return null;
        // Motion (spec §13.21): stagger continues below the front-page
        // sections, capped at rise-in-5 as everywhere.
        return (
          <section key={country} className={`mt-8 first:mt-0 rise-in rise-in-${Math.min(i + 4, 5)}`}>
            <SectionLabel muted>{country}</SectionLabel>
            {visible.map(c => (
              <Link key={c.id} to={`/competition/${c.id}`}
                className="flex items-baseline justify-between py-3.5 border-b border-rule/70">
                <span className="text-[16px]">{c.name}</span>
                <span className="font-sans text-[10px] uppercase tracking-[.14em] text-muted">
                  {c.type}
                </span>
              </Link>
            ))}
          </section>
        );
      })}
    </main>
  );
}
