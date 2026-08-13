import { useParams } from 'react-router-dom';
import { byId } from '../../domain/competitions.js';
import { useMatchDetail, useSeasonFixtures } from '../../data/queries.js';
import MatchRoom from './MatchRoom.jsx';

export default function MatchScreen() {
  const { compId, eventId } = useParams();
  const comp = byId(compId);
  const season = useSeasonFixtures(comp ?? { id: 'none', source: 'espn' });
  const fixture = season.data?.fixtures.find(f => f.id === eventId);
  const detail = useMatchDetail(comp, eventId, fixture?.status === 'live');

  if (!comp) return <p className="text-muted">Unknown competition.</p>;
  if (!fixture) {
    return <p className="text-muted">{season.isLoading ? 'Loading match…' : 'Match not found.'}</p>;
  }
  return <MatchRoom fixture={fixture} comp={comp} detail={detail.data?.detail ?? null} />;
}
