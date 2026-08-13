// api/espn.js — Vercel serverless function. Allowlisted pass-through
// proxy to ESPN's public JSON API, with edge caching (spec §4.2) and a
// last-known-good fallback that survives warm invocations.
//
// Browser : GET /api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=...
// Rewrite : (vercel.json)  /api/espn/(.*) -> /api/espn?_p=/$1
// Upstream: GET https://site.api.espn.com/apis/...
//
// IMPORTANT (spec §3.5): never attach a browser User-Agent — ESPN
// returns 403 to spoofed browser UAs and serves the default UA fine.

const UPSTREAM = 'https://site.api.espn.com';

const LEAGUE =
  '(sco\\.1|sco\\.2|sco\\.tennents|sco\\.cis|sco\\.challenge|eng\\.1|eng\\.fa|eng\\.league_cup|uefa\\.champions|uefa\\.europa|uefa\\.europa\\.conf)';
const ALLOWED = [
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/scoreboard$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/teams$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/teams/\\d+$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/summary$`),
  new RegExp(`^/apis/v2/sports/soccer/${LEAGUE}/standings$`),
];

const lastKnownGood = new Map(); // key: rest+query → { body, at }

export default async function handler(req, res) {
  const { rest, query } = extractRest(req.url);
  if (!ALLOWED.some(rx => rx.test(rest))) {
    return send(res, 400, JSON.stringify({ error: `Path not allowed: ${rest}` }));
  }
  const key = rest + query;
  try {
    const upstream = await fetch(UPSTREAM + rest + query, {
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
// fetch; a narrow window carries live scores and stays tight.
function ttlFor(rest, query) {
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
