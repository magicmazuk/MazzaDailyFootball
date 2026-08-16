import { Link, useNavigate } from 'react-router-dom';
import { byId } from '../../domain/competitions.js';
import Crest from '../../ui/Crest.jsx';
import TvBadge from '../../ui/TvBadge.jsx';
import CalendarGlyph from '../../ui/CalendarGlyph.jsx';

const when = iso => new Date(iso).toLocaleDateString('en-GB',
  { weekday: 'short', day: 'numeric', month: 'short' })
  + ' · ' + new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function NextUpRow({ club, fixture }) {
  const navigate = useNavigate();
  // Context (spec §13.12): compact, muted, non-interactive here — the row
  // is too tight for a third tap target, and the match page it already
  // links to carries the interactive context line. Unknown compId (should
  // never happen) just omits the prefix rather than crashing.
  const comp = byId(fixture.compId);
  const opponent = fixture.home.teamId === club.id ? fixture.away : fixture.home;
  const venue = fixture.home.teamId === club.id ? 'H' : 'A';
  const toTeam = e => { e.preventDefault(); e.stopPropagation();
    navigate(`/team/${fixture.compId}/${club.id}`); };
  const toCalendar = e => { e.preventDefault(); e.stopPropagation();
    navigate(`/calendar/${club.id}`); };
  return (
    <Link to={`/match/${fixture.compId}/${fixture.id}`}
      className="flex items-start gap-2.5 py-3 border-b border-rule/60">
      <button type="button" onClick={toTeam} aria-label={`${club.name} team page`}
        className="shrink-0 mt-[1px]">
        <Crest side={club} size={20} />
      </button>
      <span className="flex-1 min-w-0">
        <span className="block font-serif text-[15px] leading-snug">
          v {opponent.name} <span className="text-muted">({venue})</span>
        </span>
        <span className="mt-1 flex items-center gap-2 font-sans text-[10px] text-muted tabular-nums">
          <span className="truncate">{comp && `${comp.shortName} · `}{when(fixture.kickoff)}</span>
          <TvBadge tv={fixture.tv} />
        </span>
      </span>
      <button type="button" onClick={toCalendar} aria-label={`${club.name} calendar`}
        className="shrink-0 p-1 -mr-1">
        <CalendarGlyph />
      </button>
    </Link>
  );
}
