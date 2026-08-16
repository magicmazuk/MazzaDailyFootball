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
// under their own ESPN league code. queries.js only ever fetches the
// qualifier code's scoreboard directly (adapted under the parent comp's
// id), so QUALIFIER itself stays scoreboard-only. (Review round 2, LOW
// fix: this comment used to claim that made a qualifier code rejected on
// teams/summary/standings outright — no longer literally true, since a
// qualifier slug like uefa.champions_qual also fits LEAGUE_ANY's shape
// below and so is technically ALLOWED on the single-team teams/{id}
// route. That's harmless — path shape stays fully pinned there regardless
// of which slug it is — and moot in practice, since useSquad's
// domestic-league discovery, spec §13.20.1 review round 2, now excludes
// qualifier-shaped slugs from ever being fetched in the first place.)
const QUALIFIER = '(uefa\\.champions_qual|uefa\\.europa_qual|uefa\\.europa\\.conf_qual)';
// The scout (spec §13.20.1, review-round CRITICAL fix): useSquad discovers
// a foreign opponent's actual domestic league from team.defaultLeague
// (e.g. 'aut.1') and fetches its roster directly under THAT slug — a code
// the enumerated LEAGUE alternation can never anticipate, since it's not
// one of our own leagues/cups. Path shape is the allowlist's real safety
// job here (no slashes, so no traversal or extra path segments); WHICH
// league someone requests a public team roster for is not sensitive, so a
// single-team lookup is safe to widen. Only the ONE route below
// (teams/{numeric id}, the exact shape useSquad hits) uses this — every
// other route (scoreboard/standings/summary/plain teams-list) stays on the
// tight, enumerated LEAGUE list, since queries.js never fetches those for
// a discovered league.
const LEAGUE_ANY = '[a-z][a-z0-9._]{1,30}';
const ALLOWED = [
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/scoreboard$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${QUALIFIER}/scoreboard$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/teams$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE_ANY}/teams/\\d+$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/summary$`),
  new RegExp(`^/apis/v2/sports/soccer/${LEAGUE}/standings$`),
];
// Player bio + per-season statistics (spec §13.16). These take LEAGUE_ANY
// for the same reason the single-team route does (spec §13.20.1): a
// discovered foreign league's players fetch their bio/stats under that
// league's code (usePlayer via comp.id and bio.defaultLeagueCode), and an
// enumerated list here would 400 exactly the class of prod-only failure
// the teams-route widening fixed. Path shape stays fully pinned — numeric
// ids, fixed segment count, no slashes in the slug.
const ALLOWED_CORE = [
  new RegExp(`^/v2/sports/soccer/leagues/${LEAGUE_ANY}/seasons/\\d{4}/athletes/\\d+$`),
  new RegExp(`^/v2/sports/soccer/leagues/${LEAGUE_ANY}/seasons/\\d{4}/types/\\d/athletes/\\d+/statistics$`),
];

const lastKnownGood = new Map(); // key: rest+query → { body, at }

export default async function handler(req, res) {
  // Confirmed (review-round CRITICAL fix): ALLOWED/ALLOWED_CORE only ever
  // test `rest` (the path) — `query` (e.g. useSquad's ?enable=roster) is
  // never part of the allowlist match, on any route, and is appended
  // verbatim to the upstream URL below once the path itself clears.
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
