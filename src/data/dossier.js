// The Scout's Dossier adapters (spec §13.37) — shape the three dossier
// upstreams (behind api/dossier.js) into the identity desk's raw inputs.
// Null-tolerant throughout: a malformed payload adapts to null (objects)
// or [] (lists), never a throw — enrichment must never break a page.
//
// Payload lore (ledger, live-probed 2026-08-25): Wikipedia's REST summary
// signals ambiguity with type: "disambiguation" ("James Forrest" returns
// it); TSDB returns {"player":null} — not an empty array — on no hits;
// the FPL index arrives here ALREADY TRIMMED by the proxy (the raw
// bootstrap-static is ~700KB).

// en.wikipedia.org/api/rest_v1/page/summary/{title} → the identity card.
// `kind` carries json.type verbatim ('standard' | 'disambiguation' | ...)
// so the domain layer can detect ambiguity; portrait/original are the two
// Commons image tiers, either of which may be absent.
export function adaptWikiSummary(json) {
  if (typeof json?.title !== 'string' || typeof json?.type !== 'string') return null;
  return {
    title: json.title,
    kind: json.type,
    extract: json.extract ?? null,
    portrait: json.thumbnail?.source ?? null,
    original: json.originalimage?.source ?? null,
  };
}

// /w/api.php list=search → result titles in rank order (top hit first).
export function adaptWikiSearch(json) {
  const results = json?.query?.search;
  if (!Array.isArray(results)) return [];
  return results.map(r => r?.title).filter(t => typeof t === 'string');
}

// The proxy's trimmed /fpl/index shape { teams, players } — passthrough
// after validating both arrays are present (null if the trim ever drifts).
export function adaptFplIndex(json) {
  if (!Array.isArray(json?.teams) || !Array.isArray(json?.players)) return null;
  return { teams: json.teams, players: json.players };
}

// searchplayers.php → candidate players. strTeam is CURRENT (knows
// transfers) — the domain layer's verification hinges on it.
export function adaptTsdbPlayers(json) {
  const players = json?.player;
  if (!Array.isArray(players)) return []; // {"player":null} on no hits
  return players.map(p => ({
    name: p?.strPlayer ?? null,
    team: p?.strTeam ?? null,
    cutout: p?.strCutout ?? null,
    thumb: p?.strThumb ?? null,
  }));
}

// Keyless, no referrer lock (probed 200 PNG) — served <img>-direct, never
// proxied (spec §13.37: images are never proxied).
export const fplPhotoUrl = code =>
  `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`;
