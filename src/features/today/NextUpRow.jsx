import { Link, useNavigate } from 'react-router-dom';
import Crest from '../../ui/Crest.jsx';
import TvBadge from '../../ui/TvBadge.jsx';

const when = iso => new Date(iso).toLocaleDateString('en-GB',
  { weekday: 'short', day: 'numeric', month: 'short' })
  + ' · ' + new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function NextUpRow({ club, fixture }) {
  const navigate = useNavigate();
  const opponent = fixture.home.teamId === club.id ? fixture.away : fixture.home;
  const venue = fixture.home.teamId === club.id ? 'H' : 'A';
  const toTeam = e => { e.preventDefault(); e.stopPropagation();
    navigate(`/team/${fixture.compId}/${club.id}`); };
  return (
    <Link to={`/match/${fixture.compId}/${fixture.id}`}
      className="flex items-center gap-2.5 py-2.5 border-b border-rule/60">
      <button type="button" onClick={toTeam} aria-label={`${club.name} team page`}
        className="shrink-0">
        <Crest side={club} size={20} />
      </button>
      <span className="font-serif text-[13.5px] truncate">
        v {opponent.name} <span className="text-muted">({venue})</span>
      </span>
      <span className="ml-auto font-sans text-[10px] text-muted tabular-nums whitespace-nowrap">
        {when(fixture.kickoff)}
      </span>
      <TvBadge tv={fixture.tv} />
    </Link>
  );
}
