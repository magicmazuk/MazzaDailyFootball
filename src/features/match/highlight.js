// The highlights reel's per-fixture join (spec §13.36): does the latest
// MOTD/Sportscene episode cover THIS result, and how loudly may the line
// speak? Null off the iplayer leagues or when no episode covers — absence
// is not degradation here (§13.36 exempts these surfaces from the one-line
// law), so callers simply render nothing.
import { useHighlights, useSeasonFixtures } from '../../data/queries.js';
import { covers, highlightLine, isFeatured } from '../../domain/highlights.js';

// Hooks run unconditionally (React rules) — the RESULT is gated below, not
// the calls. The season query reuses the comp's own ['season', id] cache
// entry (MatchScreen and the competition/team lists already fetch it, so
// reaching a fixture through any list makes this a cache hit); it feeds
// the derby guard with the day's full card, so "Manchester" in a synopsis
// can never borrow the other Manchester's mention (domain/highlights.js).
export function useFixtureHighlight(fixture, comp) {
  const episodes = useHighlights();
  const season = useSeasonFixtures(comp ?? { id: 'none', source: 'espn' });
  if (!comp?.iplayer || fixture == null) return null;
  const episode = episodes.find(e => covers(e, fixture));
  if (!episode) return null;
  const card = season.data?.fixtures?.length ? season.data.fixtures : [fixture];
  const dayFixtures = card.filter(f => covers(episode, f));
  const featured = isFeatured(episode, fixture, dayFixtures);
  return { url: episode.url, line: highlightLine(episode, featured) };
}
