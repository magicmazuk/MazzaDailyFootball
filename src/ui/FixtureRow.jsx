import { Link, useNavigate } from 'react-router-dom';
import Crest from './Crest.jsx';
import StatusWord from './StatusWord.jsx';
import TvBadge from './TvBadge.jsx';

// The club-link rule (spec §13.2): the crest is the team link, the rest
// of the row is the match link. No nested anchors — the inner control
// navigates programmatically.
function TeamLine({ side, compId, followed, dim, showScore }) {
  const navigate = useNavigate();
  const toTeam = e => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/team/${compId}/${side.teamId}`);
  };
  return (
    <div className={`flex items-center gap-2.5 ${dim ? 'opacity-50' : ''}`}>
      <button type="button" onClick={toTeam} aria-label={`${side.name} team page`}
        className="shrink-0">
        <Crest side={side} size={22} />
      </button>
      <span className="font-serif text-[15px] truncate flex-1">
        {side.name}
        {followed && <span className="text-accent text-[9px] align-middle ml-1.5">★</span>}
      </span>
      {showScore && side.score != null && (
        <span className="font-serif text-[17px] tabular-nums">{side.score}</span>
      )}
    </div>
  );
}

export default function FixtureRow({ fixture, followedIds = new Set() }) {
  const dim = fixture.status === 'postponed' || fixture.status === 'canceled';
  // ESPN reports score:"0" before kickoff — never render a score for a
  // fixture that hasn't started or finished, or every scheduled match
  // in the calendar/On TV/fixture lists would show a phantom 0-0.
  const showScore = fixture.status === 'live' || fixture.status === 'ft';
  return (
    <Link to={`/match/${fixture.compId}/${fixture.id}`}
      className="block py-3 border-b border-rule/70">
      <div className="flex items-start gap-3">
        <div className="w-12 shrink-0 pt-1 space-y-1.5">
          <StatusWord fixture={fixture} />
          <TvBadge tv={fixture.tv} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <TeamLine side={fixture.home} compId={fixture.compId} showScore={showScore}
            followed={followedIds.has(fixture.home.teamId)} dim={dim} />
          <TeamLine side={fixture.away} compId={fixture.compId} showScore={showScore}
            followed={followedIds.has(fixture.away.teamId)} dim={dim} />
        </div>
      </div>
    </Link>
  );
}
