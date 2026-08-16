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
    { videoId: 'abc123', title: 'Kilmarnock 2-1 Celtic highlights' },
    { videoId: 'def456', title: 'Full match replay' },
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

  await waitFor(() => expect(result.current.data).toEqual([{ videoId: 'v1', title: 'Highlights' }]));
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

  await waitFor(() => expect(result.current.data).toEqual([{ videoId: 'v1', title: 'Sturm Graz highlights' }]));
  const requestedUrl = fetchSpy.mock.calls[0][0];
  expect(requestedUrl).toContain(`q=${encodeURIComponent('"Sturm Graz" highlights')}`);
  expect(requestedUrl).toContain('order=date');
});
