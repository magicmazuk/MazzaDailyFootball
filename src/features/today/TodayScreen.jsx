import { COMPETITIONS } from '../../domain/competitions.js';
import { useTodayWindows } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import { partitionToday } from './partition.js';
import TodayView from './TodayView.jsx';

export default function TodayScreen() {
  const followed = usePrefs(s => s.followed);
  const hidden = usePrefs(s => s.hiddenComps);
  const comps = COMPETITIONS.filter(c => !hidden.includes(c.id));
  const results = useTodayWindows(comps);

  const followedIds = new Set(Object.keys(followed));
  const fixtures = results.flatMap(r => r.data?.fixtures ?? []);
  const asOf = results.map(r => r.data?.asOf).find(Boolean) ?? null;
  const loading = results.every(r => r.isLoading);

  if (loading) return <p className="text-muted">Fetching today's football…</p>;
  return (
    <TodayView
      partition={partitionToday(fixtures, followedIds, new Date())}
      followedIds={followedIds}
      date={new Date()}
      asOf={asOf}
    />
  );
}
