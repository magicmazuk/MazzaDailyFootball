// api/bbc.js — proxy for the BBC scores/fixtures container feeding
// Scottish League One and Two (spec §3.3). Query interface instead of
// path pass-through: the upstream has exactly one endpoint and only the
// two tournaments are permitted.

const UPSTREAM = 'https://web-cdn.api.bbci.co.uk/wc-data/container/sport-data-scores-fixtures';
const TOURNAMENTS = new Set([
  'scottish-league-one', 'scottish-league-two', 'scottish-league-cup', 'scottish-cup',
]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const lastKnownGood = new Map();

export default async function handler(req, res) {
  const params = new URLSearchParams(req.url.split('?')[1] ?? '');
  const tournament = params.get('tournament');
  const start = params.get('start');
  const end = params.get('end');
  if (!TOURNAMENTS.has(tournament) || !DATE.test(start ?? '') || !DATE.test(end ?? '')) {
    return send(res, 400, JSON.stringify({ error: 'tournament, start and end are required' }));
  }

  const upstreamUrl = `${UPSTREAM}?selectedStartDate=${start}&selectedEndDate=${end}` +
    `&todayDate=${new Date().toISOString().slice(0, 10)}` +
    `&urn=${encodeURIComponent(`urn:bbc:sportsdata:football:tournament:${tournament}`)}`;
  const key = `${tournament}:${start}:${end}`;

  try {
    const upstream = await fetch(upstreamUrl, { headers: { accept: 'application/json' } });
    const text = await upstream.text();
    if (upstream.ok && looksLikeJson(text)) {
      lastKnownGood.set(key, { body: text, at: new Date().toISOString() });
      const days = (new Date(end) - new Date(start)) / 86400000;
      const ttl = days > 3 ? { fresh: 3600, swr: 604800 } : { fresh: 30, swr: 300 };
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

function looksLikeJson(text) {
  try { return JSON.parse(text) != null; } catch { return false; }
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(body);
}
