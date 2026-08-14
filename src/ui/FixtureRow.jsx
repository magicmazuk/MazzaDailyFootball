import { Link } from 'react-router-dom';
import Crest from './Crest.jsx';
import StatusWord from './StatusWord.jsx';

function TeamLine({ side, followed, dim }) {
  return (
    <div className={`flex items-center gap-2.5 ${dim ? 'opacity-50' : ''}`}>
      <Crest side={side} size={22} />
      <span className="font-serif text-[15px] truncate flex-1">
        {side.name}
        {followed && <span className="text-accent text-[9px] align-middle ml-1.5">★</span>}
      </span>
      {side.score != null && (
        <span className="font-serif text-[17px] tabular-nums">{side.score}</span>
      )}
    </div>
  );
}

export default function FixtureRow({ fixture, followedIds = new Set() }) {
  const dim = fixture.status === 'postponed' || fixture.status === 'canceled';
  return (
    <Link to={`/match/${fixture.compId}/${fixture.id}`}
      className="block py-3 border-b border-rule/70">
      <div className="flex items-start gap-3">
        <div className="w-12 shrink-0 pt-1"><StatusWord fixture={fixture} /></div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <TeamLine side={fixture.home} followed={followedIds.has(fixture.home.teamId)} dim={dim} />
          <TeamLine side={fixture.away} followed={followedIds.has(fixture.away.teamId)} dim={dim} />
        </div>
      </div>
    </Link>
  );
}
