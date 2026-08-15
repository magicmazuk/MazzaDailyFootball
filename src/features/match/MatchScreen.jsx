import { useParams } from 'react-router-dom';
import { byId } from '../../domain/competitions.js';
import { useMatchDetail, useSeasonFixtures } from '../../data/queries.js';
import MatchRoom from './MatchRoom.jsx';
import { siblingFixtures } from './siblings.js';
import { useMatchVideos } from './video.js';

// BBC-merged cup fixtures (spec §13.7) carry a synthetic `bbc-` id — there
// is no matching ESPN event, so a summary fetch for it can only 404. Treat
// match detail as unpublished for that one fixture (not the whole
// competition, which may have real ESPN detail for its other fixtures) so
// MatchRoom shows its existing honest degraded line instead of firing a
// doomed request. Keyed off eventId (known synchronously from the URL),
// not the fetched fixture — the fixture is still loading on first render,
// and the summary query must never fire even for that one render.
export function matchRoomComp(comp, eventId) {
  if (comp && eventId?.startsWith('bbc-')) return { ...comp, hasMatchDetail: false };
  return comp;
}

export default function MatchScreen() {
  const { compId, eventId } = useParams();
  const comp = byId(compId);
  const season = useSeasonFixtures(comp ?? { id: 'none', source: 'espn' });
  const fixture = season.data?.fixtures.find(f => f.id === eventId);
  const roomComp = matchRoomComp(comp, eventId);
  const detail = useMatchDetail(roomComp ?? { id: 'none', hasMatchDetail: false }, eventId,
    fixture?.status === 'live');
  const videos = useMatchVideos(fixture);

  if (!comp) return <p className="text-muted">Unknown competition.</p>;
  if (!fixture) {
    return <p className="text-muted">{season.isLoading ? 'Loading match…' : 'Match not found.'}</p>;
  }
  const siblings = siblingFixtures(season.data?.fixtures ?? [], fixture);
  return <MatchRoom fixture={fixture} comp={roomComp} detail={detail.data?.detail ?? null}
    videos={videos.data ?? []} siblings={siblings} />;
}
