// Contextual match video (spec §13.9): a YouTube search for a finished
// fixture's highlights. The one place the app talks to a third-party API
// with a client-side key — everything else goes through our own proxy.
import { useQuery } from '@tanstack/react-query';

// Single accessor over the one client-side API key this app carries
// (referrer-locked in Google Cloud) — kept behind a function so every
// caller (and every test) goes through one seam rather than reading
// import.meta.env directly.
export function youtubeKey() {
  return import.meta.env.VITE_YOUTUBE_API_KEY ?? null;
}

export function buildVideoQuery(fixture) {
  const date = new Date(fixture.kickoff).toLocaleDateString('en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' });
  return `${fixture.home.name} vs ${fixture.away.name} highlights ${date}`;
}

// params is an optional extra-query-params bag (e.g. { order: 'date' } for
// the team-video call below) — empty by default, so the match-video call
// above stays byte-identical to before this seam grew a second caller.
export async function searchVideos(query, key, params = {}) {
  const extra = Object.entries(params).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video`
    + `&maxResults=5&q=${encodeURIComponent(query)}&key=${key}${extra}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for YouTube search`);
  const data = await r.json();
  return (data.items ?? [])
    .filter(item => item?.id?.videoId)
    .map(item => ({ videoId: item.id.videoId, title: item.snippet?.title ?? '' }));
}

// A finished match's highlights don't change — cache forever once fetched
// (staleTime: Infinity) and never retry a failed search (quota-friendly,
// and the caller treats a rejected query as simply "no videos").
export function useMatchVideos(fixture) {
  return useQuery({
    queryKey: ['videos', fixture?.compId, fixture?.id],
    enabled: fixture?.status === 'ft' && !!youtubeKey(),
    staleTime: Infinity,
    retry: false,
    queryFn: () => searchVideos(buildVideoQuery(fixture), youtubeKey()),
  });
}

// The scout film (spec §13.20.3): recent highlights for a DISCOVERED
// foreign opponent's club, not a specific fixture — no date in the query,
// recency instead comes from the API's order=date param. LAZY by design:
// `enabled` is caller-controlled (the card only flips it true once tapped),
// so this never spends quota just from the team page mounting. Cached
// forever once fetched and never retried, same reasoning as match videos.
export function buildTeamVideoQuery(team) {
  return `"${team.name}" highlights`;
}

export function useTeamVideos(team, enabled) {
  return useQuery({
    queryKey: ['team-videos', team?.id],
    enabled: enabled && !!youtubeKey(),
    staleTime: Infinity,
    retry: false,
    queryFn: () => searchVideos(buildTeamVideoQuery(team), youtubeKey(), { order: 'date' }),
  });
}
