import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import MatchScreen, { matchRoomComp } from './MatchScreen.jsx';
import { byId } from '../../domain/competitions.js';

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
});

function renderAt(path) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="match/:compId/:eventId" element={<MatchScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('an unknown competition id shows the honest message, not a white screen', () => {
  renderAt('/match/does-not-exist/e1');
  expect(screen.getByText('Unknown competition.')).toBeInTheDocument();
});

test('matchRoomComp marks a BBC-merged fixture (bbc- eventId) as having no match detail', () => {
  const cup = byId('sco.cis');
  const roomComp = matchRoomComp(cup, 'bbc-b1');
  expect(roomComp.hasMatchDetail).toBe(false);
  // The rest of the competition identity is untouched — same name, id.
  expect(roomComp.id).toBe('sco.cis');
  expect(roomComp.name).toBe(cup.name);
});

test('matchRoomComp leaves an ESPN-native fixture (no bbc- prefix) alone', () => {
  const cup = byId('sco.cis');
  expect(matchRoomComp(cup, 'e1')).toBe(cup);
});

test('matchRoomComp tolerates a missing comp or eventId', () => {
  expect(matchRoomComp(undefined, 'bbc-b1')).toBeUndefined();
  expect(matchRoomComp(byId('sco.cis'), undefined)).toBe(byId('sco.cis'));
});

test('a BBC-merged cup fixture never fires the doomed ESPN summary fetch and shows the honest degraded line', async () => {
  const bbcFixturePayload = JSON.stringify({
    eventGroups: [{ secondaryGroups: [{ events: [
      { id: 'b1', startDateTime: '2026-08-15T16:45:00Z', status: 'PreEvent',
        home: { id: 'h', fullName: 'Dundee United' }, away: { id: 'a', fullName: 'Celtic' } },
    ] }] }],
  });
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url.includes('/summary')) return new Response('{}', { status: 200 }); // must never be requested
    if (url.includes('/scoreboard')) return new Response(JSON.stringify({ events: [] }), { status: 200 });
    if (url.includes('/api/bbc')) {
      const start = new URL(url, 'http://x').searchParams.get('start');
      const body = start === '2026-08-01' ? bbcFixturePayload : JSON.stringify({ eventGroups: [] });
      return new Response(body, { status: 200 });
    }
    if (url.includes('/teams')) {
      return new Response(JSON.stringify({ sports: [{ leagues: [{ teams: [] }] }] }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  }));

  renderAt('/match/sco.cis/bbc-b1');

  await screen.findByText("Detailed stats aren't published for Scottish League Cup.");
  expect(calls.some(u => u.includes('/summary'))).toBe(false);
});

// --- contextual match video wiring (spec §13.9) ---

const ftScoreboard = JSON.stringify({
  events: [{
    id: 'e1', date: '2026-08-09T14:00:00Z', status: { type: { name: 'STATUS_FULL_TIME' } },
    competitions: [{ competitors: [
      { homeAway: 'home', team: { id: 'kil', displayName: 'Kilmarnock' } },
      { homeAway: 'away', team: { id: 'cel', displayName: 'Celtic' } },
    ] }],
  }],
});

const originalYtKey = import.meta.env.VITE_YOUTUBE_API_KEY;
afterEach(() => {
  if (originalYtKey === undefined) delete import.meta.env.VITE_YOUTUBE_API_KEY;
  else import.meta.env.VITE_YOUTUBE_API_KEY = originalYtKey;
});

test('a finished fixture with a YouTube key fetches highlights and shows the video card', async () => {
  import.meta.env.VITE_YOUTUBE_API_KEY = 'stub-key-for-test';
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url.includes('googleapis.com')) {
      return new Response(JSON.stringify({
        items: [{ id: { videoId: 'v1' }, snippet: { title: 'Kilmarnock 1-2 Celtic highlights' } }],
      }), { status: 200 });
    }
    if (url.includes('/scoreboard')) return new Response(ftScoreboard, { status: 200 });
    return new Response('{}', { status: 200 });
  }));

  renderAt('/match/sco.1/e1');

  await screen.findByText('Kilmarnock 1-2 Celtic highlights');
});

test('a finished fixture with no YouTube key never calls the YouTube API', async () => {
  delete import.meta.env.VITE_YOUTUBE_API_KEY;
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url.includes('/scoreboard')) return new Response(ftScoreboard, { status: 200 });
    return new Response('{}', { status: 200 });
  }));

  renderAt('/match/sco.1/e1');

  await screen.findByText('Kilmarnock');
  expect(calls.some(u => u.includes('googleapis.com'))).toBe(false);
});
