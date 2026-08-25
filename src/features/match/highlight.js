// The highlights reel's per-fixture join (spec §13.36): does the latest
// MOTD/Sportscene episode cover THIS result, and how loudly may the line
// speak? Null off the iplayer leagues or when no episode covers — absence
// is not degradation here (§13.36 exempts these surfaces from the one-line
// law), so callers simply render nothing.
import { useHighlights, useSeasonFixtures } from '../../data/queries.js';
import { covers, highlightLine, isFeatured } from '../../domain/highlights.js';

// Hooks run unconditionally (React rules) — the RESULT is gated below, not
// the calls, and the season query is gated by `enabled` so off-iplayer
// comps never fetch (an ungated { id: 'none' } read would 400 against the
// ESPN allowlist). On the iplayer leagues it reuses the comp's own
// ['season', id] cache entry (MatchScreen and the lists already fetch it);
// it feeds the derby guard with the day's full card, so "Manchester" in a
// synopsis can never borrow the other Manchester's mention.
export function useFixtureHighlight(fixture, comp) {
  const episodes = useHighlights();
  const season = useSeasonFixtures(comp ?? { id: 'none', source: 'espn' },
    { enabled: !!comp?.iplayer });
  if (!comp?.iplayer || fixture == null) return null;
  const episode = episodes.find(e => covers(e, fixture));
  if (!episode) return null;
  const card = season.data?.fixtures?.length ? season.data.fixtures : [fixture];
  const dayFixtures = card.filter(f => covers(episode, f));
  const featured = isFeatured(episode, fixture, dayFixtures);
  return { url: episode.url, line: highlightLine(episode, featured) };
}
