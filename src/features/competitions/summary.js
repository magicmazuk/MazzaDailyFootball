// "In play elsewhere" (spec §13.34): one honest line per active
// tournament, derived from the season fixtures already in cache — never a
// new fetch. Live wins; otherwise the nearest round inside a fortnight;
// otherwise nothing, and the competition lives only in the list below.
// League fixtures carry the season slug as their round — prettifyRound's
// rejection keeps a phantom round off the line (day-only instead).
import { prettifyRound } from '../../domain/round.js';

const FORTNIGHT = 14 * 24 * 60 * 60 * 1000;
const day = iso => new Date(iso).toLocaleDateString('en-GB',
  { weekday: 'short', day: 'numeric', month: 'short' });

export function activeSummary(fixtures, now = new Date()) {
  const fs = fixtures ?? [];
  const live = fs.find(f => f.status === 'live');
  if (live) {
    const round = prettifyRound(live.round);
    return { live: true, text: round ? `Live · ${round}` : 'Live' };
  }
  const upcoming = fs
    .filter(f => f.status === 'scheduled')
    .filter(f => {
      const dt = new Date(f.kickoff) - now;
      return dt > 0 && dt <= FORTNIGHT;
    })
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];
  if (!upcoming) return null;
  const round = prettifyRound(upcoming.round);
  const when = day(upcoming.kickoff);
  return { live: false, text: round ? `${round} · ${when}` : when };
}
