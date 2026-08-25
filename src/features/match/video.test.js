import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  buildTeamVideoQuery, buildVideoQuery, searchVideos, useMatchVideos, useTeamVideos, youtubeKey,
} from './video.js';

// No JSX in this file (it's plain .js, per the brief's file list) — the
// QueryClientProvider wrapper is built with createElement instead.
function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

test('buildVideoQuery joins both team names, "highlights" and the full en-GB kickoff date', () => {
  const fixture = {
    id: 'e1', compId: 'sco.1', status: 'ft', kickoff: '2026-08-09T14:00:00Z',
    home: { teamId: 'kil', name: 'Kilmarnock' },
    away: { teamId: 'cel', name: 'Celtic' },
  };
  expect(buildVideoQuery(fixture)).toBe('Kilmarnock vs Celtic highlights 9 August 2026');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('searchVideos maps items to {videoId, title}, skipping entries with no id.videoId', async () => {
  const payload = {
    items: [
      { id: { videoId: 'abc123' }, snippet: { title: 'Kilmarnock 2-1 Celtic highlights' } },
      { id: {}, snippet: { title: 'no video id, should be skipped' } },
      { id: { videoId: 'def456' }, snippet: { title: 'Full match replay' } },
    ],
  };
  const fetchSpy = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);

  const result = await searchVideos('Kilmarnock vs Celtic highlights', 'test-key');

  expect(result).toEqual([
    { videoId: 'abc123', title: 'Kilmarnock 2-1 Celtic highlights', channelTitle: '' },
    { videoId: 'def456', title: 'Full match replay', channelTitle: '' },
  ]);
  const requestedUrl = fetchSpy.mock.calls[0][0];
  expect(requestedUrl).toContain('https://www.googleapis.com/youtube/v3/search');
  expect(requestedUrl).toContain('q=Kilmarnock%20vs%20Celtic%20highlights');
  expect(requestedUrl).toContain('key=test-key');
});

test('searchVideos throws on a non-ok response so the caller can treat it as no videos', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));
  await expect(searchVideos('q', 'bad-key')).rejects.toThrow();
});

// youtubeKey() is a single accessor over import.meta.env so callers (and
// tests) never read the raw env var directly. Never assert on the real
// local key's value here — only ever on stubbed test values.
const originalKey = import.meta.env.VITE_YOUTUBE_API_KEY;
afterEach(() => {
  if (originalKey === undefined) delete import.meta.env.VITE_YOUTUBE_API_KEY;
  else import.meta.env.VITE_YOUTUBE_API_KEY = originalKey;
});

test('youtubeKey returns the env var when set', () => {
  import.meta.env.VITE_YOUTUBE_API_KEY = 'stub-key-for-test';
  expect(youtubeKey()).toBe('stub-key-for-test');
});

test('youtubeKey returns null when the env var is unset', () => {
  delete import.meta.env.VITE_YOUTUBE_API_KEY;
  expect(youtubeKey()).toBeNull();
});

const ftFixture = {
  id: 'e1', compId: 'sco.1', status: 'ft', kickoff: '2026-08-09T14:00:00Z',
  home: { teamId: 'kil', name: 'Kilmarnock' },
  away: { teamId: 'cel', name: 'Celtic' },
};

test('useMatchVideos never fetches for a fixture that has not finished, even with a key set', async () => {
  import.meta.env.VITE_YOUTUBE_API_KEY = 'stub-key-for-test';
  const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);

  const scheduled = { ...ftFixture, status: 'scheduled' };
  const { result } = renderHook(() => useMatchVideos(scheduled), { wrapper });

  expect(result.current.fetchStatus).toBe('idle');
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('useMatchVideos never fetches for a finished fixture with no key set', async () => {
  delete import.meta.env.VITE_YOUTUBE_API_KEY;
  const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);

  const { result } = renderHook(() => useMatchVideos(ftFixture), { wrapper });

  expect(result.current.fetchStatus).toBe('idle');
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('useMatchVideos fetches and resolves videos for a finished fixture with a key set', async () => {
  import.meta.env.VITE_YOUTUBE_API_KEY = 'stub-key-for-test';
  const payload = { items: [{ id: { videoId: 'v1' }, snippet: { title: 'Highlights' } }] };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));

  const { result } = renderHook(() => useMatchVideos(ftFixture), { wrapper });

  await waitFor(() => expect(result.current.data).toEqual([{ videoId: 'v1', title: 'Highlights', channelTitle: '' }]));
});

test('the match-video request never carries order=date — that param is additive-only for the team query', async () => {
  import.meta.env.VITE_YOUTUBE_API_KEY = 'stub-key-for-test';
  const fetchSpy = vi.fn(async () => new Response('{"items":[]}', { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);

  const { result } = renderHook(() => useMatchVideos(ftFixture), { wrapper });

  await waitFor(() => expect(result.current.data).toEqual([]));
  expect(fetchSpy.mock.calls[0][0]).not.toContain('order=');
});

// --- the scout film (spec §13.20.3): useTeamVideos extends the same seam
// for a discovered foreign opponent's club highlights — LAZY by design, so
// `enabled` is entirely caller-controlled (the card flips it true only once
// tapped) rather than derived from fixture status the way useMatchVideos is. ---

test('buildTeamVideoQuery quotes the club name and appends "highlights", no date', () => {
  expect(buildTeamVideoQuery({ id: '4411', name: 'Sturm Graz' })).toBe('"Sturm Graz" highlights');
});

const scoutTeam = { id: '4411', name: 'Sturm Graz' };

test('useTeamVideos never fetches while enabled is false, even with a key set', async () => {
  import.meta.env.VITE_YOUTUBE_API_KEY = 'stub-key-for-test';
  const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);

  const { result } = renderHook(() => useTeamVideos(scoutTeam, false), { wrapper });

  expect(result.current.fetchStatus).toBe('idle');
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('useTeamVideos never fetches when enabled is true but no key is set', async () => {
  delete import.meta.env.VITE_YOUTUBE_API_KEY;
  const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);

  const { result } = renderHook(() => useTeamVideos(scoutTeam, true), { wrapper });

  expect(result.current.fetchStatus).toBe('idle');
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('useTeamVideos fetches and resolves videos when enabled and a key is set, ordered by date', async () => {
  import.meta.env.VITE_YOUTUBE_API_KEY = 'stub-key-for-test';
  const payload = { items: [{ id: { videoId: 'v1' }, snippet: { title: 'Sturm Graz highlights' } }] };
  const fetchSpy = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);

  const { result } = renderHook(() => useTeamVideos(scoutTeam, true), { wrapper });

  await waitFor(() => expect(result.current.data).toEqual([{ videoId: 'v1', title: 'Sturm Graz highlights', channelTitle: '' }]));
  const requestedUrl = fetchSpy.mock.calls[0][0];
  expect(requestedUrl).toContain(`q=${encodeURIComponent('"Sturm Graz" highlights')}`);
  expect(requestedUrl).toContain('order=date');
});

// --- the lower leagues, looked after (spec §13.32) ---
import { filterVideos } from './video.js';
import { byId } from '../../domain/competitions.js';

test('the grift vocabulary is dropped by title or channel — FIFA-engine "highlights" never reach a card', () => {
  const items = [
    { videoId: 'a', title: 'Celtic vs Rangers Highlights | Premiership', channelTitle: 'Sky Sports Football' },
    { videoId: 'b', title: 'Celtic vs Rangers FIFA 26 Gameplay Highlights', channelTitle: 'ProSimGoals' },
    { videoId: 'c', title: 'Celtic v Rangers | eFootball simulation', channelTitle: 'Match Sims' },
    { videoId: 'd', title: 'Rangers career mode rebuild!', channelTitle: 'FCFan' },
    { videoId: 'e', title: 'Celtic vs Rangers score prediction', channelTitle: 'PredictorTV' },
    { videoId: 'f', title: 'Hearts 6-2 Inverness CT | League Cup highlights', channelTitle: 'FC 25 Zone' },
  ];
  expect(filterVideos(items).map(v => v.videoId)).toEqual(['a']);
});

test('real titles containing innocent substrings survive the blocklist', () => {
  const items = [
    { videoId: 'a', title: 'Gameplay analysis: how Celtic pressed', channelTitle: 'Tactics Desk' },
    { videoId: 'b', title: 'Bonnyrigg Rose vs Gala Fairydean highlights', channelTitle: 'Lowland League TV' },
  ];
  // 'Gameplay' IS blocked vocabulary — dropped by design (the farm uses it
  // constantly; a genuine tactics channel losing one card is the cheap side
  // of the trade). The second survives untouched.
  expect(filterVideos(items).map(v => v.videoId)).toEqual(['b']);
});

test('video search never fires for a comp flagged hasVideo false', () => {
  expect(byId('wosfl.first').hasVideo).toBe(false);
  expect(byId('scottish-league-one').hasVideo).toBe(false);
  expect(byId('scottish-league-two').hasVideo).toBe(false);
  expect(byId('sco.1').hasVideo).not.toBe(false);
});

// --- the Scout Player reel (spec §13.35): the scout film's sibling for a
// single player — lazy, cached forever, grift-filtered at the shared seam.
import { buildPlayerVideoQuery, usePlayerVideos } from './video.js';

test('the player query quotes the name and anchors it to football', () => {
  expect(buildPlayerVideoQuery('Cláudio Braga')).toBe('"Cláudio Braga" football highlights');
});

// The sharpened reel (spec §13.37, §13.35's deferred item): when the club
// is known the query anchors to IT — sharper than the generic 'football'.
test('a known club sharpens the player query to "name" club highlights', () => {
  expect(buildPlayerVideoQuery('James Forrest', 'Celtic')).toBe('"James Forrest" Celtic highlights');
});

test('a null club keeps the current football-anchored form', () => {
  expect(buildPlayerVideoQuery('James Forrest', null)).toBe('"James Forrest" football highlights');
});

test('usePlayerVideos threads the club through to the sharpened query', async () => {
  vi.stubEnv('VITE_YOUTUBE_API_KEY', 'k');
  const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);
  renderHook(() => usePlayerVideos({ id: 'p1', name: 'Braga' }, true, 'Aberdeen'), { wrapper });
  await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
  expect(fetchSpy.mock.calls[0][0]).toContain(encodeURIComponent('"Braga" Aberdeen highlights'));
});

test('usePlayerVideos never fetches until enabled, even with a key set', async () => {
  vi.stubEnv('VITE_YOUTUBE_API_KEY', 'k');
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  renderHook(() => usePlayerVideos({ id: 'p1', name: 'Cláudio Braga' }, false), { wrapper });
  await new Promise(r => setTimeout(r, 50));
  expect(fetcher).not.toHaveBeenCalled();
});

test('usePlayerVideos fetches once enabled and resolves through the shared (grift-filtered) seam', async () => {
  vi.stubEnv('VITE_YOUTUBE_API_KEY', 'k');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [
    { id: { videoId: 'real' }, snippet: { title: 'Braga skills', channelTitle: 'Hearts TV' } },
    { id: { videoId: 'fake' }, snippet: { title: 'Braga FIFA 26 gameplay', channelTitle: 'SimZone' } },
  ] }), { status: 200 })));
  const { result } = renderHook(() => usePlayerVideos({ id: 'p1', name: 'Braga' }, true), { wrapper });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data.map(v => v.videoId)).toEqual(['real']);
});
