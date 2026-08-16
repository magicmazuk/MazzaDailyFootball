import { beforeEach, expect, test, vi } from 'vitest';
import { bbcUrl, espnUrl, getText, newsUrl } from './client.js';

test('espnUrl composes path and query', () => {
  expect(espnUrl('/apis/site/v2/sports/soccer/sco.1/scoreboard', { dates: '20260701-20270630', limit: 500 }))
    .toBe('/api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=20260701-20270630&limit=500');
  expect(espnUrl('/apis/v2/sports/soccer/eng.1/standings', { season: 2026 }))
    .toBe('/api/espn/apis/v2/sports/soccer/eng.1/standings?season=2026');
});

test('bbcUrl composes the query form', () => {
  expect(bbcUrl('scottish-league-one', '2026-07-01', '2027-06-30'))
    .toBe('/api/bbc?tournament=scottish-league-one&start=2026-07-01&end=2027-06-30');
});

test('newsUrl composes the feed query form', () => {
  expect(newsUrl('celtic')).toBe('/api/news?feed=celtic');
  expect(newsUrl('football')).toBe('/api/news?feed=football');
});

beforeEach(() => { vi.unstubAllGlobals(); });

test('getText resolves the raw body text and surfaces the x-lkg-at header', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<rss></rss>', {
    status: 200, headers: { 'x-lkg-at': '2026-08-13T09:00:00.000Z' },
  })));
  const { text, asOf } = await getText('/api/news?feed=celtic');
  expect(text).toBe('<rss></rss>');
  expect(asOf).toBe('2026-08-13T09:00:00.000Z');
});

test('getText resolves asOf to null when the header is absent', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<rss></rss>', { status: 200 })));
  const { asOf } = await getText('/api/news?feed=celtic');
  expect(asOf).toBeNull();
});

test('getText throws on a non-ok response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));
  await expect(getText('/api/news?feed=celtic')).rejects.toThrow('HTTP 500');
});
