import { Link } from 'react-router-dom';
import Crest from '../../ui/Crest.jsx';

// Quick-view table (spec §13.1): top four plus any followed club's row.
// The whole widget is one link — detail lives on the competition page.
export default function MiniTable({ comp, rows, followedIds }) {
  if (!rows?.length) return null;
  const top = rows.slice(0, 4);
  const followedBelow = rows.filter(r => r.position > 4 && followedIds.has(r.teamId));
  return (
    <Link to={`/competition/${comp.id}`} className="block mb-6">
      <div className="flex items-baseline justify-between pb-2 mb-2 border-b border-ink">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[.2em] text-accent">
          {comp.shortName}
        </span>
        <span className="font-sans text-[9px] uppercase tracking-[.14em] text-muted">
          Full table →
        </span>
      </div>
      {top.map(r => <Row key={r.teamId} r={r} followedIds={followedIds} />)}
      {followedBelow.length > 0 && (
        <p className="text-muted text-center leading-none py-1" aria-hidden>⋯</p>
      )}
      {followedBelow.map(r => <Row key={r.teamId} r={r} followedIds={followedIds} />)}
    </Link>
  );
}

function Row({ r, followedIds }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="w-4 font-sans text-[11px] text-muted tabular-nums">{r.position}</span>
      <Crest side={r} size={18} />
      <span className="flex-1 min-w-0 truncate text-[13.5px]">
        {r.name}
        {followedIds.has(r.teamId) && <span className="text-accent text-[8px] align-middle ml-1">★</span>}
      </span>
      <span className="text-[14px] tabular-nums">{r.points}</span>
    </div>
  );
}
