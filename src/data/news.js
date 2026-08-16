// BBC Sport RSS → domain adapter for The papers (spec §13.19.2). Pure and
// DOMParser-based (works in jsdom, so this needs nothing from the proxy —
// that lives in api/news.js and the fetch itself in queries.js' useNews).

const MEDIA_NS = 'http://search.yahoo.com/mrss/';
const MAX_ITEMS = 5;

function firstText(item, tag) {
  return item.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
}

// Descriptions (and occasionally titles) arrive either HTML-entity-escaped
// or CDATA-wrapped around markup ("<p>...</p>"). Either way, firstText()
// above has already unwrapped the CDATA/entities down to a string that may
// still contain literal HTML tags — this is untrusted third-party content
// (BBC RSS), so stripping it MUST use an inert parse. DOMParser's returned
// document has no browsing context: it never executes <script>, never
// fires <img onerror=...>, never loads any resource. Setting .innerHTML on
// a live document's element (even one never attached to the page) does
// NOT have that guarantee — handlers can still fire at parse time. This is
// the load-bearing reason for going through DOMParser here rather than a
// detached div.
function plainText(raw) {
  if (!raw) return '';
  const text = new DOMParser().parseFromString(raw, 'text/html').body?.textContent ?? '';
  return text.trim();
}

// media:thumbnail is a namespaced element — getElementsByTagNameNS is the
// namespace-aware lookup; a plain 'media:thumbnail' name lookup is kept as
// a fallback for parsers that don't resolve the prefix. Only https: URLs
// are trusted through — http:, data:, javascript: and anything else fall
// back to null (the caller degrades to a full-width text-only row).
function thumbnailUrl(item) {
  const byNs = item.getElementsByTagNameNS?.(MEDIA_NS, 'thumbnail')?.[0];
  const el = byNs ?? item.getElementsByTagName('media:thumbnail')[0];
  const url = el?.getAttribute('url') ?? null;
  return url && url.startsWith('https://') ? url : null;
}

function toIso(pubDate) {
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Up to 5 clean items; malformed or empty XML degrades to [] rather than
// throwing — callers (Papers.jsx) render their own degraded one-liner for
// an empty list, never a crash.
export function adaptFeed(xmlString) {
  if (!xmlString) return [];
  let doc;
  try {
    doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  } catch {
    return [];
  }
  if (!doc || doc.getElementsByTagName('parsererror').length > 0) return [];

  const items = [...doc.getElementsByTagName('item')].slice(0, MAX_ITEMS);
  return items
    .map(item => {
      const link = firstText(item, 'link');
      const guid = firstText(item, 'guid');
      const pubDate = firstText(item, 'pubDate');
      return {
        id: guid || link,
        title: plainText(firstText(item, 'title')),
        description: plainText(firstText(item, 'description')),
        link,
        publishedAt: pubDate ? toIso(pubDate) : null,
        thumbnail: thumbnailUrl(item),
      };
    })
    .filter(it => it.id);
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Pure formatter (spec §13.19.2): 'just now' under a minute old, then
// minutes, hours, days, in ascending granularity. A missing/unparseable
// iso (e.g. an item with no pubDate) returns '' rather than misreading
// "no timestamp" as "the Unix epoch" and printing a nonsense multi-decade
// span — callers render the meta line without the " · Nx ago" suffix.
export function timeAgo(iso, now = new Date()) {
  if (!iso) return '';
  const published = new Date(iso);
  if (Number.isNaN(published.getTime())) return '';
  const diffMs = now.getTime() - published.getTime();
  const minutes = Math.floor(diffMs / MIN);
  if (minutes < 1) return 'just now';
  if (diffMs < HOUR) return `${minutes}m ago`;
  const hours = Math.floor(diffMs / HOUR);
  if (diffMs < DAY) return `${hours}h ago`;
  return `${Math.floor(diffMs / DAY)}d ago`;
}
