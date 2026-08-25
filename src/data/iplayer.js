// BBC iPlayer highlights adapters (spec §13.36, The Highlights Reel) —
// shapes /programmes JSON (behind api/iplayer.js) into episode objects.
//
// Payload lore (ledger, live-probed 2026-08-25): the first broadcast in
// episodes/last.json MAY BE A REPEAT AIRING of the latest episode (a
// Monday 08:00 repeat of Sunday's MOTD), so the episode's covered
// matchday keys off programme.first_broadcast_date — NEVER the
// broadcast's schedule_date and NEVER is_repeat, which flag the airing,
// not the episode.

// en-CA formats as YYYY-MM-DD; Europe/London pins the calendar day the
// episode first aired regardless of the machine's zone.
function londonDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

// episodes/last.json → the latest episode, or null when none is listed.
export function adaptLastEpisode(json) {
  const programme = json?.broadcasts?.[0]?.programme;
  if (!programme) return null;
  return {
    pid: programme.pid ?? null,
    title: programme.title ?? null,
    date: londonDate(programme.first_broadcast_date),
    firstBroadcast: programme.first_broadcast_date ?? null,
    // Missing available_until means available (ledger) — callers treat
    // null as "not expiring", only a past date as gone.
    availableUntil: programme.available_until ?? null,
    synopsis: programme.short_synopsis ?? null,
  };
}

// {pid}.json episode detail → the long synopsis when one exists.
// Sportscene episodes may carry no long_synopsis (verified m0030s0h) —
// fall through medium to short.
export function adaptEpisode(json) {
  const programme = json?.programme;
  if (!programme) return null;
  return {
    pid: programme.pid ?? null,
    date: londonDate(programme.first_broadcast_date),
    synopsis: programme.long_synopsis ?? programme.medium_synopsis
      ?? programme.short_synopsis ?? null,
  };
}

// Verified deep-link shape (ledger) — link out only, never embed (DRM).
export const episodeUrl = pid => `https://www.bbc.co.uk/iplayer/episode/${pid}`;
