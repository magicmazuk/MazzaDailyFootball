import { adaptFeed, timeAgo } from './news.js';

function rssWithItems(items) {
  const xmlItems = items.map(it => `
    <item>
      <title><![CDATA[${it.title}]]></title>
      <description><![CDATA[${it.description}]]></description>
      <link>${it.link}</link>
      <guid isPermaLink="false">${it.guid}</guid>
      <pubDate>${it.pubDate}</pubDate>
      ${it.thumbnail ? `<media:thumbnail width="144" height="81" url="${it.thumbnail}"/>` : ''}
    </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
    <rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
      <channel>
        <title>BBC Sport - Football</title>
        ${xmlItems}
      </channel>
    </rss>`;
}

const sixItems = [
  { title: 'Celtic win at Ibrox', description: '<p>Celtic secured all three points &amp; the bragging rights.</p>',
    link: 'https://www.bbc.co.uk/sport/football/1', guid: 'https://www.bbc.co.uk/sport/football/1',
    pubDate: 'Thu, 13 Aug 2026 09:00:00 GMT', thumbnail: 'https://ichef.bbci.co.uk/img1.jpg' },
  { title: 'Second story', description: 'Plain text description, no markup.',
    link: 'https://www.bbc.co.uk/sport/football/2', guid: 'https://www.bbc.co.uk/sport/football/2',
    pubDate: 'Thu, 13 Aug 2026 08:00:00 GMT' },
  { title: 'Third story', description: 'Standfirst three.',
    link: 'https://www.bbc.co.uk/sport/football/3', guid: 'https://www.bbc.co.uk/sport/football/3',
    pubDate: 'Thu, 13 Aug 2026 07:00:00 GMT' },
  { title: 'Fourth story', description: 'Standfirst four.',
    link: 'https://www.bbc.co.uk/sport/football/4', guid: 'https://www.bbc.co.uk/sport/football/4',
    pubDate: 'Thu, 13 Aug 2026 06:00:00 GMT' },
  { title: 'Fifth story', description: 'Standfirst five.',
    link: 'https://www.bbc.co.uk/sport/football/5', guid: 'https://www.bbc.co.uk/sport/football/5',
    pubDate: 'Thu, 13 Aug 2026 05:00:00 GMT' },
  { title: 'Sixth story (should be dropped)', description: 'Standfirst six.',
    link: 'https://www.bbc.co.uk/sport/football/6', guid: 'https://www.bbc.co.uk/sport/football/6',
    pubDate: 'Thu, 13 Aug 2026 04:00:00 GMT' },
];

test('adapts a full feed down to at most 5 clean items', () => {
  const items = adaptFeed(rssWithItems(sixItems));
  expect(items).toHaveLength(5);
});

test('strips CDATA and embedded HTML tags/entities from title and description', () => {
  const [first] = adaptFeed(rssWithItems(sixItems));
  expect(first.title).toBe('Celtic win at Ibrox');
  expect(first.description).toBe('Celtic secured all three points & the bragging rights.');
});

test('id prefers guid, falls back to link', () => {
  const [first] = adaptFeed(rssWithItems(sixItems));
  expect(first.id).toBe('https://www.bbc.co.uk/sport/football/1');
  expect(first.link).toBe('https://www.bbc.co.uk/sport/football/1');
});

test('publishedAt is an ISO string derived from pubDate', () => {
  const [first] = adaptFeed(rssWithItems(sixItems));
  expect(first.publishedAt).toBe(new Date('Thu, 13 Aug 2026 09:00:00 GMT').toISOString());
});

test('media:thumbnail url attribute is read namespace-aware', () => {
  const [first] = adaptFeed(rssWithItems(sixItems));
  expect(first.thumbnail).toBe('https://ichef.bbci.co.uk/img1.jpg');
});

test('missing media:thumbnail yields null, not undefined or empty string', () => {
  const [, second] = adaptFeed(rssWithItems(sixItems));
  expect(second.thumbnail).toBeNull();
});

test.each([
  ['http://ichef.bbci.co.uk/img.jpg'], // insecure scheme
  ['data:image/png;base64,AAAA'], // inline payload, not a real fetch
])('a %s thumbnail url is rejected down to null — only https: is trusted', url => {
  const feed = rssWithItems([{ title: 'Story', description: 'Standfirst.',
    link: 'https://www.bbc.co.uk/sport/football/x', guid: 'https://www.bbc.co.uk/sport/football/x',
    pubDate: 'Thu, 13 Aug 2026 09:00:00 GMT', thumbnail: url }]);
  expect(adaptFeed(feed)[0].thumbnail).toBeNull();
});

// --- inert parsing (security fix, review round 1) ---
// Titles/descriptions are untrusted third-party content (BBC RSS). Tag
// stripping MUST go through an inert DOMParser document rather than a live
// div's innerHTML — a live-document parse can execute inline event
// handlers (e.g. <img onerror=...>) even on an element that's never
// attached to the page. This proves both halves: the handler never runs,
// AND the visible text comes out clean.
test('a title containing an <img onerror> payload never executes it, and strips down to clean text', () => {
  window.exploited = undefined;
  const evil = rssWithItems([{
    title: '<img src="x" onerror="window.exploited = true">Breaking news',
    description: 'Standfirst.', link: 'https://www.bbc.co.uk/sport/football/evil',
    guid: 'https://www.bbc.co.uk/sport/football/evil', pubDate: 'Thu, 13 Aug 2026 09:00:00 GMT',
  }]);
  const [item] = adaptFeed(evil);
  expect(item.title).toBe('Breaking news');
  expect(window.exploited).toBeUndefined();
});

test('malformed XML yields an empty list rather than throwing', () => {
  expect(adaptFeed('<rss><channel><item><title>unclosed')).toEqual([]);
  expect(adaptFeed('this is not xml at all')).toEqual([]);
});

test('empty/absent feed yields an empty list', () => {
  expect(adaptFeed(rssWithItems([]))).toEqual([]);
  expect(adaptFeed('')).toEqual([]);
  expect(adaptFeed(null)).toEqual([]);
  expect(adaptFeed(undefined)).toEqual([]);
});

// --- timeAgo ---

const now = new Date('2026-08-13T12:00:00Z');

test('just now for anything under a minute old', () => {
  expect(timeAgo(new Date('2026-08-13T11:59:30Z').toISOString(), now)).toBe('just now');
});

test('minutes ago under an hour old', () => {
  expect(timeAgo(new Date('2026-08-13T11:15:00Z').toISOString(), now)).toBe('45m ago');
});

test('hours ago under a day old', () => {
  expect(timeAgo(new Date('2026-08-13T09:00:00Z').toISOString(), now)).toBe('3h ago');
});

test('days ago beyond 24 hours', () => {
  expect(timeAgo(new Date('2026-08-11T12:00:00Z').toISOString(), now)).toBe('2d ago');
});

test('a missing or unparseable timestamp yields an empty string, not a nonsense epoch-derived span', () => {
  expect(timeAgo(null, now)).toBe('');
  expect(timeAgo(undefined, now)).toBe('');
  expect(timeAgo('', now)).toBe('');
  expect(timeAgo('not a date', now)).toBe('');
});
