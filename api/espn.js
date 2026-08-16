// api/espn.js — Vercel serverless function. Allowlisted pass-through
// proxy to ESPN's public JSON API, with edge caching (spec §4.2) and a
// last-known-good fallback that survives warm invocations.
//
// Browser : GET /api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=...
// Rewrite : (vercel.json)  /api/espn/(.*) -> /api/espn?_p=/$1
// Upstream: GET https://site.api.espn.com/apis/...
//
// Player endpoints (spec §13.16) live on a different ESPN host —
// sports.core.api.espn.com, no /apis prefix — so they get their own
// allowlist below and route to UPSTREAM_CORE instead.
//
// IMPORTANT (spec §3.5): never attach a browser User-Agent — ESPN
// returns 403 to spoofed browser UAs and serves the default UA fine.

const UPSTREAM = 'https://site.api.espn.com';
const UPSTREAM_CORE = 'https://sports.core.api.espn.com';

const LEAGUE =
  '(sco\\.1|sco\\.2|sco\\.tennents|sco\\.cis|sco\\.challenge|eng\\.1|eng\\.fa|eng\\.league_cup|uefa\\.champions|uefa\\.europa|uefa\\.europa\\.conf)';
// The three UEFA club competitions' qualifying rounds (spec §13.11) live
// under their own ESPN league code — scoreboard only, never teams/
// summary/standings, since queries.js only ever fetches the qualifier
// code's scoreboard and adapts it under the parent comp's id.
const QUALIFIER = '(uefa\\.champions_qual|uefa\\.europa_qual|uefa\\.europa\\.conf_qual)';
const ALLOWED = [
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/scoreboard$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${QUALIFIER}/scoreboard$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/teams$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/teams/\\d+$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/summary$`),
  new RegExp(`^/apis/v2/sports/soccer/${LEAGUE}/standings$`),
];
// Player bio + per-season statistics (spec §13.16) — the qualifier codes
// have no player data of their own, so only the 11 base league ids apply.
const ALLOWED_CORE = [
  new RegExp(`^/v2/sports/soccer/leagues/${LEAGUE}/seasons/\\d{4}/athletes/\\d+$`),
  new RegExp(`^/v2/sports/soccer/leagues/${LEAGUE}/seasons/\\d{4}/types/\\d/athletes/\\d+/statistics$`),
];

const lastKnownGood = new Map(); // key: rest+query → { body, at }

export default async function handler(req, res) {
  const { rest, query } = extractRest(req.url);
  const upstreamHost = ALLOWED_CORE.some(rx => rx.test(rest)) ? UPSTREAM_CORE
    : ALLOWED.some(rx => rx.test(rest)) ? UPSTREAM
    : null;
  if (!upstreamHost) {
    return send(res, 400, JSON.stringify({ error: `Path not allowed: ${rest}` }));
  }
  const key = rest + query;
  try {
    const upstream = await fetch(upstreamHost + rest + query, {
      headers: { accept: 'application/json' },
    });
    const text = await upstream.text();
    if (upstream.ok && !looksLikeErrorBody(text)) {
      lastKnownGood.set(key, { body: text, at: new Date().toISOString() });
      const ttl = ttlFor(rest, query);
      res.setHeader('Cache-Control',
        `public, s-maxage=${ttl.fresh}, stale-while-revalidate=${ttl.swr}`);
      return send(res, 200, text);
    }
    return serveFallback(res, key, upstream.status, text);
  } catch (err) {
    return serveFallback(res, key, 502, JSON.stringify({ error: String(err?.message ?? err) }));
  }
}

function serveFallback(res, key, status, failureBody) {
  res.setHeader('Cache-Control', 'no-store');
  const lkg = lastKnownGood.get(key);
  if (lkg) {
    res.setHeader('x-lkg-at', lkg.at);
    return send(res, 200, lkg.body);
  }
  return send(res, status >= 400 ? status : 502, failureBody);
}

// ESPN sometimes answers HTTP 200 with an error body (spec §3.5) —
// never store or cache one of those as "good".
function looksLikeErrorBody(text) {
  try {
    const j = JSON.parse(text);
    return j == null || j.error != null || j.errors != null;
  } catch {
    return true;
  }
}

// Edge TTLs from spec §4.2. A dates window over 3 days is a season
// fetch; a narrow window carries live scores and stays tight. Player
// statistics move during a match week (600/86400, spec §13.16) while a
// player's bio is essentially static (86400/604800, same as teams).
function ttlFor(rest, query) {
  if (rest.includes('/statistics')) return { fresh: 600, swr: 86400 };
  if (/\/athletes\/\d+$/.test(rest)) return { fresh: 86400, swr: 604800 };
  if (rest.includes('/standings')) return { fresh: 600, swr: 86400 };
  if (/\/teams(\/|$)/.test(rest)) return { fresh: 86400, swr: 604800 };
  if (rest.includes('/summary')) return { fresh: 30, swr: 120 };
  const m = /dates=(\d{8})-(\d{8})/.exec(query);
  if (m && spanDays(m[1], m[2]) > 3) return { fresh: 3600, swr: 604800 };
  return { fresh: 30, swr: 300 };
}

function spanDays(a, b) {
  const d = s => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
  return (d(b) - d(a)) / 86400000;
}

// Handles both the local-dev path form and the rewritten ?_p= form.
function extractRest(reqUrl) {
  const [pathOnly, search = ''] = reqUrl.split('?');
  const params = new URLSearchParams(search);
  const rewritten = params.get('_p');
  if (rewritten) {
    params.delete('_p');
    const q = params.toString();
    return { rest: rewritten.startsWith('/') ? rewritten : `/${rewritten}`, query: q ? `?${q}` : '' };
  }
  const PREFIX = '/api/espn';
  const rest = pathOnly.startsWith(PREFIX) ? pathOnly.slice(PREFIX.length) : pathOnly;
  return { rest: rest || '/', query: search ? `?${search}` : '' };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(body);
}
