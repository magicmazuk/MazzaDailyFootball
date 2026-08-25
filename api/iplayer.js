// api/iplayer.js — Vercel serverless function (spec §13.36, The Highlights
// Reel). Allowlisted pass-through proxy to the BBC's public /programmes
// JSON service — free, keyless, alive (spiked 2026-08-25) — with the same
// edge caching + last-known-good discipline as api/wosfl.js.
//
// Browser : GET /api/iplayer/b007t9y1/episodes/last.json
// Rewrite : (vercel.json)  /api/iplayer/(.*) -> /api/iplayer?_p=/$1
// Upstream: GET https://www.bbc.co.uk/programmes/...
//
// Exactly two route shapes: episodes/last.json for the two highlights
// brands (b007t9y1 MOTD, m002jryr Sportscene: Premiership Highlights),
// and episode detail by pid — any 8-char pid passes, the LEAGUE_ANY
// precedent (api/espn.js). Nothing else passes.

const UPSTREAM = 'https://www.bbc.co.uk/programmes';

const ALLOWED = [
  /^\/(b007t9y1|m002jryr)\/episodes\/last\.json$/,
  /^\/[a-z0-9]{8}\.json$/,
];

const lastKnownGood = new Map(); // rest → { body, at }

// BBC error responses arrive as HTML pages, not JSON error bodies — the
// never-cache-a-200-with-error-body law (spec §3.5) here means: only a
// body that parses as a JSON object may be cached or served as good.
function isJsonObjectBody(text) {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

// Dual-mode like api/espn.js: prod arrives via the vercel.json rewrite
// (?_p=/...), the dev api-shim passes the raw /api/iplayer/... path.
function extractRest(reqUrl) {
  const [pathOnly, search = ''] = reqUrl.split('?');
  const rewritten = new URLSearchParams(search).get('_p');
  if (rewritten) return rewritten.startsWith('/') ? rewritten : `/${rewritten}`;
  const PREFIX = '/api/iplayer';
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
    // www.bbc.co.uk 403s NON-browser callers, so this proxy sends a
    // browser User-Agent — the exact INVERSE of the ESPN rule (which
    // 403s browser UAs). Never let one proxy's UA discipline leak into
    // the other.
    const upstream = await fetch(UPSTREAM + rest, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        accept: 'application/json',
      },
    });
    const text = await upstream.text();
    if (upstream.ok && isJsonObjectBody(text)) {
      lastKnownGood.set(rest, { body: text, at: new Date().toISOString() });
      // A new episode lands once a day at most — half-hour freshness is
      // honest, a day of stale-while-revalidate keeps the reel resilient.
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
