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
  const upstreamUrl = FEEDS[feed];
  if (!upstreamUrl) {
    return send(res, 400, JSON.stringify({ error: 'feed must be celtic or football' }), 'application/json');
  }

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

function looksLikeXml(text) {
  return typeof text === 'string' && text.trimStart().startsWith('<');
}

function send(res, status, body, contentType = 'text/xml') {
  res.statusCode = status;
  res.setHeader('content-type', contentType);
  res.end(body);
}
