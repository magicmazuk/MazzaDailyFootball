// api/wosfl.js — Vercel serverless function (spec §13.31, The Local Club).
// Allowlisted pass-through proxy to LeagueRepublic's public JSON API — the
// West of Scotland Football League's official data home — with the same
// edge caching + last-known-good discipline as api/espn.js.
//
// Browser : GET /api/wosfl/getFixturesForFixtureGroup/1/4781136.json
// Rewrite : (vercel.json)  /api/wosfl/(.*) -> /api/wosfl?_p=/$1
// Upstream: GET https://api.leaguerepublic.com/json/...
//
// The API is public, keyless and documented (LeagueRepublic API Reference).
// Field lore (spike, 2026-08-21): the league's WEBSITE fronts CloudFront
// that 403s non-browser callers, but this API host served every probe
// without auth. Verified from a deployed Vercel preview before this
// shipped — the mocked-green-prod-400 lesson applies to new upstreams.
//
// Exactly four routes, ids strictly numeric, fixture types 1-9 (1 league,
// 2 cup per the fixtureGroupsForSeason payload). Nothing else passes.

const UPSTREAM = 'https://api.leaguerepublic.com/json';

const ALLOWED = [
  /^\/getFixtureGroupsForSeason\/\d{1,12}\.json$/,
  /^\/getTeamsForFixtureGroup\/\d\/\d{1,12}\.json$/,
  /^\/getFixturesForFixtureGroup\/\d\/\d{1,12}\.json$/,
  /^\/getStandingsForFixtureGroup\/\d\/\d{1,12}\.json$/,
];

const lastKnownGood = new Map(); // rest → { body, at }

// LR error bodies come back HTTP 200 with {"error": "..."} — the
// never-cache-a-200-with-error-body law (spec §3.5) applies here too.
function looksLikeErrorBody(text) {
  const head = text.slice(0, 200).trim();
  return head.startsWith('{') && head.includes('"error"');
}

// Dual-mode like api/espn.js: prod arrives via the vercel.json rewrite
// (?_p=/...), the dev api-shim passes the raw /api/wosfl/... path.
function extractRest(reqUrl) {
  const [pathOnly, search = ''] = reqUrl.split('?');
  const rewritten = new URLSearchParams(search).get('_p');
  if (rewritten) return rewritten.startsWith('/') ? rewritten : `/${rewritten}`;
  const PREFIX = '/api/wosfl';
  const rest = pathOnly.startsWith(PREFIX) ? pathOnly.slice(PREFIX.length) : pathOnly;
  return rest || '/';
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(body);
}

export default async function handler(req, res) {
  const rest = extractRest(req.url);
  if (!ALLOWED.some(rx => rx.test(rest))) {
    return send(res, 400, JSON.stringify({ error: `Path not allowed: ${rest}` }));
  }
  try {
    const upstream = await fetch(UPSTREAM + rest, { headers: { accept: 'application/json' } });
    const text = await upstream.text();
    if (upstream.ok && !looksLikeErrorBody(text)) {
      lastKnownGood.set(rest, { body: text, at: new Date().toISOString() });
      // Junior results land by hand after full time — half-hour freshness
      // is honest for this level, a day of stale-while-revalidate keeps
      // Saturday teatime resilient.
      res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
      return send(res, 200, text);
    }
    return serveFallback(res, rest, upstream.status, text);
  } catch (err) {
    return serveFallback(res, rest, 502, JSON.stringify({ error: String(err?.message ?? err) }));
  }
}

function serveFallback(res, rest, status, failureBody) {
  const good = lastKnownGood.get(rest);
  if (good) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.setHeader('x-mdf-last-known-good', good.at);
    return send(res, 200, good.body);
  }
  return send(res, status >= 400 ? status : 502, failureBody);
}
