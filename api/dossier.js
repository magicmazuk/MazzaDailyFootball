// api/dossier.js — Vercel serverless function (spec §13.37, The Scout's
// Dossier). One allowlisted proxy fronting the three dossier upstreams by
// path prefix — Wikipedia (bio + portrait), FPL bootstrap-static (eng.1
// headshot codes), TheSportsDB (last face tier) — with the api/iplayer.js
// discipline: dual-mode extractRest, last-known-good, edge caching.
//
// Browser : GET /api/dossier/wiki/summary/James_Forrest
//           GET /api/dossier/wiki/search?q=James%20Forrest%20footballer%20Celtic
//           GET /api/dossier/fpl/index
//           GET /api/dossier/tsdb/James%20Forrest
// Rewrite : (vercel.json)  /api/dossier/(.*) -> /api/dossier?_p=/$1
//
// /fpl/index is the ONE route that transforms: the raw bootstrap-static
// payload is ~700KB, so the proxy trims it to { teams, players } and
// caches the TRIMMED body as last-known-good. Everything else passes
// through. IMAGES are never proxied — Commons, resources.premierleague.com
// and TSDB's r2 CDN serve <img> directly (spec §13.37).

// A third UA discipline, distinct from BOTH neighbours: ESPN 403s browser
// UAs (api/espn.js sends none), www.bbc.co.uk 403s NON-browser callers
// (api/iplayer.js impersonates Chrome) — and Wikimedia etiquette asks for
// a DESCRIPTIVE, identifying UA, never a browser one. The same honest UA
// suits FPL and TSDB. Never let one proxy's UA discipline leak into another.
const UA = 'MazzaDailyFootball/1.0 (personal football app)';

// One alphabet for every dynamic value, checked in DECODED form: letters,
// digits, the name punctuation, literal spaces and unicode. Two hard-won
// rules live here (both caught live, 2026-08-25): never test a safe-chars
// regex against encodeURIComponent's output (it is itself always
// %-and-alphanumerics - the check becomes vacuous), and never assume a
// path segment arrives encoded - the dev shim passes %20 through RAW, but
// Vercel's rewrite substitutes $1 DECODED, so "Callum McGregor" reaches
// prod with a literal space (v1.12.0's first prod probe 400d on exactly
// this). Decode tolerantly, validate decoded, re-encode on forwarding.
const SAFE_DECODED = /^[A-Za-z0-9_().,' À-￿-]+$/;

function decodeSegment(raw) {
  try { return decodeURIComponent(raw); } catch { return raw; }
}

// Bios and TSDB records change rarely — and TSDB's free tier rate-limits,
// so cache hard: a day fresh, a week stale-while-revalidate. FPL squads
// shift on transfers: six hours fresh, a day stale.
const CACHE_DAY = 'public, s-maxage=86400, stale-while-revalidate=604800';
const CACHE_QUARTER_DAY = 'public, s-maxage=21600, stale-while-revalidate=86400';

const lastKnownGood = new Map(); // key → { body, at }

// The never-cache-a-200-with-error-body law (spec §3.5): only a body that
// parses as a JSON object may be cached or served as good.
function isJsonObjectBody(text) {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

// Dual-mode like api/iplayer.js: prod arrives via the vercel.json rewrite
// (?_p=/..., other query params passed through alongside), the dev
// api-shim passes the raw /api/dossier/... path.
function extractRest(reqUrl) {
  const [pathOnly, search = ''] = reqUrl.split('?');
  const params = new URLSearchParams(search);
  const rewritten = params.get('_p');
  const rest = rewritten
    ? (rewritten.startsWith('/') ? rewritten : `/${rewritten}`)
    : (pathOnly.startsWith('/api/dossier') ? pathOnly.slice('/api/dossier'.length) : pathOnly);
  return { rest: rest || '/', params };
}

// The allowlist IS the router: each entry resolves a rest (+ params) to an
// upstream URL, cache policy and optional transform — or null, and null
// everywhere means 400. The last-known-good key includes the query for
// /wiki/search so different searches never serve each other's fallback.
function resolveRoute(rest, params) {
  let m = rest.match(/^\/wiki\/summary\/([^/]+)$/);
  if (m) {
    const title = decodeSegment(m[1]);
    if (!SAFE_DECODED.test(title)) return null;
    // Spaces become underscores — Wikipedia's canonical title form — so
    // both arrival shapes share one upstream URL and one fallback key.
    const enc = encodeURIComponent(title.replace(/ /g, '_'));
    return {
      key: `/wiki/summary/${enc}`,
      url: `https://en.wikipedia.org/api/rest_v1/page/summary/${enc}`,
      cache: CACHE_DAY,
    };
  }
  if (rest === '/wiki/search') {
    const q = params.get('q');
    if (!q || !SAFE_DECODED.test(q)) return null;
    const enc = encodeURIComponent(q);
    return {
      key: `/wiki/search?q=${enc}`,
      url: `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc}&srlimit=5&format=json`,
      cache: CACHE_DAY,
    };
  }
  if (rest === '/fpl/index') {
    return {
      key: rest,
      url: 'https://fantasy.premierleague.com/api/bootstrap-static/',
      cache: CACHE_QUARTER_DAY,
      trim: trimFplIndex,
    };
  }
  m = rest.match(/^\/tsdb\/([^/]+)$/);
  if (m) {
    const name = decodeSegment(m[1]);
    if (!SAFE_DECODED.test(name)) return null;
    const enc = encodeURIComponent(name);
    return {
      key: `/tsdb/${enc}`,
      url: `https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${enc}`,
      cache: CACHE_DAY,
    };
  }
  return null;
}

// ~700KB of bootstrap-static → the few fields the dossier joins on.
// squad_number in elements[] is 0/610 filled — DEAD, never trust it
// (ledger 2026-08-25); joins are name-within-team, photos key off code.
function trimFplIndex(text) {
  try {
    const raw = JSON.parse(text);
    if (!Array.isArray(raw?.teams) || !Array.isArray(raw?.elements)) return null;
    return JSON.stringify({
      teams: raw.teams.map(t => ({ id: t.id, name: t.name })),
      players: raw.elements.map(e => ({
        code: e.code,
        first: e.first_name,
        second: e.second_name,
        web: e.web_name,
        team: e.team,
        // The fantasy ladder (spec 13.40): season and gameweek points.
        points: e.total_points,
        event: e.event_points,
      })),
    });
  } catch {
    return null;
  }
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(body);
}

export default async function handler(req, res) {
  const { rest, params } = extractRest(req.url);
  const route = resolveRoute(rest, params);
  if (!route) {
    return send(res, 400, JSON.stringify({ error: `Path not allowed: ${rest}` }));
  }
  try {
    const upstream = await fetch(route.url, {
      headers: { 'user-agent': UA, accept: 'application/json' },
    });
    const text = await upstream.text();
    if (upstream.ok) {
      const body = route.trim
        ? route.trim(text)
        : (isJsonObjectBody(text) ? text : null);
      if (body !== null) {
        lastKnownGood.set(route.key, { body, at: new Date().toISOString() });
        res.setHeader('Cache-Control', route.cache);
        return send(res, 200, body);
      }
    }
    return serveFallback(res, route.key, upstream.status, text);
  } catch (err) {
    return serveFallback(res, route.key, 502, JSON.stringify({ error: String(err?.message ?? err) }));
  }
}

function serveFallback(res, key, status, failureBody) {
  const good = lastKnownGood.get(key);
  if (good) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.setHeader('x-mdf-last-known-good', good.at);
    return send(res, 200, good.body);
  }
  return send(res, status >= 400 ? status : 502, failureBody);
}
