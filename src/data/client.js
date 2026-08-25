// Browser-side fetch helpers. Every URL points at our own proxy — the
// browser never talks to ESPN or the BBC directly (spec §4.2).

export function espnUrl(rest, params = {}) {
  const q = new URLSearchParams(params).toString();
  return `/api/espn${rest}${q ? `?${q}` : ''}`;
}

export function bbcUrl(tournament, start, end) {
  return `/api/bbc?tournament=${tournament}&start=${start}&end=${end}`;
}

export function newsUrl(feed) {
  return `/api/news?feed=${feed}`;
}

// The Local Club (spec §13.31): LeagueRepublic behind our own proxy —
// same one-hop rule as ESPN and the BBC.
export function wosflUrl(rest) {
  return `/api/wosfl${rest}`;
}

// The Highlights Reel (spec §13.36): BBC /programmes behind our own
// proxy — same one-hop rule.
export function iplayerUrl(rest) {
  return `/api/iplayer${rest}`;
}

export async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return { data: await r.json(), asOf: r.headers.get('x-lkg-at') };
}

// The news proxy passes through raw XML, not JSON — getJson would fail to
// parse it, hence this sibling that resolves the raw body text instead.
export async function getText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return { text: await r.text(), asOf: r.headers.get('x-lkg-at') };
}
