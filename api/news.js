// api/news.js — proxy for the two BBC Sport RSS feeds behind "The papers"
// on Today (spec §13.19.2). Query interface, not path pass-through: the
// upstream serves many feeds and only these two are ever permitted — no
// arbitrary URLs, ever.

const FEEDS = {
  celtic: 'https://feeds.bbci.co.uk/sport/football/teams/celtic/rss.xml',
  football: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
};

const lastKnownGood = new Map(); // key: feed → { body, at }

export default async function handler(req, res) {
  const params = new URLSearchParams(req.url.split('?')[1] ?? '');
  const feed = params.get('feed');
  // Object.hasOwn, not a bare FEEDS[feed] truthiness check: FEEDS is a
  // plain object literal, so feed values like '__proto__' or 'constructor'
  // resolve via the prototype chain to a real (truthy) object rather than
  // undefined — that would sail past a `!upstreamUrl` guard, reach fetch()
  // with a non-URL value, and surface as a misleading 502 instead of the
  // contracted 400. hasOwn only ever matches the two real keys.
  if (!Object.hasOwn(FEEDS, feed ?? '')) {
    return send(res, 400, JSON.stringify({ error: 'feed must be celtic or football' }), 'application/json');
  }
  const upstreamUrl = FEEDS[feed];

  try {
    const upstream = await fetch(upstreamUrl, { headers: { accept: 'application/rss+xml, text/xml' } });
    const text = await upstream.text();
    if (upstream.ok && looksLikeXml(text)) {
      lastKnownGood.set(feed, { body: text, at: new Date().toISOString() });
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
      return send(res, 200, text);
    }
    return serveFallback(res, feed, upstream.status, text);
  } catch (err) {
    return serveFallback(res, feed, 502, JSON.stringify({ error: String(err?.message ?? err) }));
  }
}

function serveFallback(res, feed, status, failureBody) {
  res.setHeader('Cache-Control', 'no-store');
  const lkg = lastKnownGood.get(feed);
  if (lkg) {
    res.setHeader('x-lkg-at', lkg.at);
    return send(res, 200, lkg.body);
  }
  return send(res, status >= 400 ? status : 502, failureBody, 'application/json');
}

// A CDN/WAF outage page still answers with HTTP 200 and a body starting
// with '<' (an HTML error page) — a bare "starts with '<'" check would
// wrongly cache that as last-known-good. Reject an HTML doctype outright,
// and additionally require an actual feed root tag near the top of the
// body — real BBC RSS opens with an XML declaration then <rss ...> within
// the first line or two, well inside this 300-char window.
function looksLikeXml(text) {
  if (typeof text !== 'string') return false;
  const head = text.slice(0, 300);
  if (/^\s*<!doctype\s+html/i.test(head)) return false;
  return /<rss\b|<feed\b/i.test(head);
}

function send(res, status, body, contentType = 'text/xml') {
  res.statusCode = status;
  res.setHeader('content-type', contentType);
  res.end(body);
}
