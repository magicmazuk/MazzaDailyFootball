// Browser-side fetch helpers. Every URL points at our own proxy — the
// browser never talks to ESPN or the BBC directly (spec §4.2).

export function espnUrl(rest, params = {}) {
  const q = new URLSearchParams(params).toString();
  return `/api/espn${rest}${q ? `?${q}` : ''}`;
}

export function bbcUrl(tournament, start, end) {
  return `/api/bbc?tournament=${tournament}&start=${start}&end=${end}`;
}

export async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return { data: await r.json(), asOf: r.headers.get('x-lkg-at') };
}
