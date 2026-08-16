import { beforeEach, expect, test, vi } from 'vitest';
import handler from '../../../api/news.js';

function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b; },
  };
}
const call = async url => {
  const res = fakeRes();
  await handler({ url }, res);
  return res;
};

beforeEach(() => { vi.unstubAllGlobals(); });

test('rejects unknown or missing feeds without fetching', async () => {
  const spy = vi.fn();
  vi.stubGlobal('fetch', spy);
  expect((await call('/api/news?feed=arsenal')).statusCode).toBe(400);
  expect((await call('/api/news')).statusCode).toBe(400);
  expect((await call('/api/news?feed=')).statusCode).toBe(400);
  expect(spy).not.toHaveBeenCalled();
});

test('no arbitrary URL passthrough — an unrecognised feed value never reaches fetch, whatever shape it takes', async () => {
  const spy = vi.fn();
  vi.stubGlobal('fetch', spy);
  const res = await call(`/api/news?feed=${encodeURIComponent('https://evil.example.com/x.xml')}`);
  expect(res.statusCode).toBe(400);
  expect(spy).not.toHaveBeenCalled();
});

// The handler's last-known-good Map is module-level and persists for the
// life of this file (same convention as bbc.test.js/espn.test.js) — the
// two "no prior LKG" tests below must run before anything else populates
// the 'celtic' key, so they come first among the feed=celtic cases.

test('a non-200 upstream response with no prior last-known-good surfaces the failure', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('server error', { status: 500 })));
  const res = await call('/api/news?feed=celtic');
  expect(res.statusCode).toBe(500);
});

test('a 200 with a non-XML body is never cached as last-known-good', async () => {
  const url = '/api/news?feed=celtic';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('not xml at all', { status: 200 })));
  const first = await call(url);
  // No prior LKG exists yet, so this bad-but-200 response still surfaces —
  // the point under test is that it must not have been STORED as good.
  expect(first.statusCode).not.toBe(200);

  vi.stubGlobal('fetch', vi.fn(async () => new Response('server error', { status: 500 })));
  const second = await call(url);
  // If the earlier non-XML 200 had wrongly been cached, this would now 200
  // with that bad body instead of surfacing the failure.
  expect(second.statusCode).toBe(500);
  expect(second.headers['x-lkg-at']).toBeUndefined();
});

test('feed=celtic maps to exactly the Celtic team feed and passes the XML body through', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<rss><channel><item/></channel></rss>', { status: 200 })));
  const res = await call('/api/news?feed=celtic');
  expect(res.statusCode).toBe(200);
  expect(res.body).toBe('<rss><channel><item/></channel></rss>');
  expect(res.headers['content-type']).toBe('text/xml');
  expect(res.headers['cache-control']).toBe('public, s-maxage=900, stale-while-revalidate=3600');
  expect(fetch).toHaveBeenCalledWith(
    'https://feeds.bbci.co.uk/sport/football/teams/celtic/rss.xml',
    expect.anything(),
  );
});

test('feed=football maps to exactly the general football feed', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<rss><channel/></rss>', { status: 200 })));
  const res = await call('/api/news?feed=football');
  expect(res.statusCode).toBe(200);
  expect(fetch).toHaveBeenCalledWith(
    'https://feeds.bbci.co.uk/sport/football/rss.xml',
    expect.anything(),
  );
});

test('failure serves last-known-good with x-lkg-at, and never overwrites it with a bad response', async () => {
  const url = '/api/news?feed=celtic';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<rss><channel><item><title>Good</title></item></channel></rss>', { status: 200 })));
  const good = await call(url);
  expect(good.statusCode).toBe(200);

  vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));
  const res = await call(url);
  expect(res.statusCode).toBe(200);
  expect(res.body).toBe('<rss><channel><item><title>Good</title></item></channel></rss>');
  expect(res.headers['x-lkg-at']).toBeTruthy();
});
