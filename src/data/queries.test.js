import { beforeEach, expect, test, vi } from 'vitest';
import { seasonFixturesQuery, todayWindowQuery } from './queries.js';

const comp = { id: 'scottish-league-one', source: 'bbc' };

const bbcResponse = id => ({
  eventGroups: [{ secondaryGroups: [{ events: [
    { id, startDateTime: '2026-08-01T14:00:00Z', status: 'PostEvent',
      home: { id: 'h', fullName: 'Home', score: '1' },
      away: { id: 'a', fullName: 'Away', score: '0' } },
  ] }] }],
});

beforeEach(() => { vi.unstubAllGlobals(); });

test('season fixtures for a BBC competition fan out one request per calendar month, never a season-long range', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    const id = new URL(url, 'http://x').searchParams.get('start');
    return new Response(JSON.stringify(bbcResponse(id)), { status: 200 });
  }));

  const { fixtures } = await seasonFixturesQuery(comp).queryFn();

  // 2026-07-01 .. 2027-06-30 is 12 calendar months.
  expect(calls).toHaveLength(12);
  for (const url of calls) {
    const u = new URL(url, 'http://x');
    const start = u.searchParams.get('start');
    const end = u.searchParams.get('end');
    // Never a season-long window — start and end must share a calendar month.
    expect(start.slice(0, 7)).toBe(end.slice(0, 7));
    expect(start.endsWith('-01')).toBe(true);
  }
  expect(calls[0]).toContain('start=2026-07-01');
  expect(calls[0]).toContain('end=2026-07-31');
  expect(calls[11]).toContain('start=2027-06-01');
  expect(calls[11]).toContain('end=2027-06-30');
  // Results concatenated in month order, one fixture per month here.
  expect(fixtures).toHaveLength(12);
  expect(fixtures[0].id).toBe('2026-07-01');
  expect(fixtures[11].id).toBe('2027-06-01');
});

test('today window for a BBC competition issues two single-day requests, not a 2-day range', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    const id = new URL(url, 'http://x').searchParams.get('start');
    return new Response(JSON.stringify(bbcResponse(id)), { status: 200 });
  }));

  const now = new Date('2026-08-14T12:00:00Z');
  const { fixtures } = await todayWindowQuery(comp, now).queryFn();

  expect(calls).toHaveLength(2);
  for (const url of calls) {
    const u = new URL(url, 'http://x');
    expect(u.searchParams.get('start')).toBe(u.searchParams.get('end'));
  }
  expect(calls[0]).toContain('start=2026-08-13');
  expect(calls[0]).toContain('end=2026-08-13');
  expect(calls[1]).toContain('start=2026-08-14');
  expect(calls[1]).toContain('end=2026-08-14');
  expect(fixtures).toHaveLength(2);
  expect(fixtures[0].id).toBe('2026-08-13');
  expect(fixtures[1].id).toBe('2026-08-14');
});
