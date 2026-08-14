import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
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
