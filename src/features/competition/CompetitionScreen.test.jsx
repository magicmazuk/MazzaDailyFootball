// Cheap wiring assertions for the cup Overview tab (spec §13.10) — tab
// set/default per comp.type/hasTable, and the season-loading state. The
// StructureStrip/FieldBoard component tests carry the real behavioural
// coverage; this file only checks CompetitionScreen wires them in.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import CompetitionScreen from './CompetitionScreen.jsx';

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 })));
});

function renderAt(compId) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/competition/${compId}`]}>
        <Routes>
          <Route path="competition/:compId" element={<CompetitionScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('a cup without a table defaults to Overview, with Fixtures/Results alongside', () => {
  renderAt('sco.tennents');
  expect(screen.getByRole('button', { name: 'Overview' })).toHaveClass('bg-ink');
  expect(screen.getByRole('button', { name: 'Fixtures' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Results' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Table' })).toBeNull();
});

test('a hasTable cup (the European ones) gets Overview, Table, Fixtures, Results, still Overview default', () => {
  renderAt('uefa.champions');
  expect(screen.getByRole('button', { name: 'Overview' })).toHaveClass('bg-ink');
  expect(screen.getByRole('button', { name: 'Table' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Fixtures' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Results' })).toBeInTheDocument();
});

test('leagues are unchanged: no Overview tab, Table still the default', () => {
  renderAt('sco.1');
  expect(screen.queryByRole('button', { name: 'Overview' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Table' })).toHaveClass('bg-ink');
});

test('while the season query loads, Overview shows a muted loading line instead of the field', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // never resolves
  renderAt('sco.tennents');
  expect(screen.getByText('Loading the field…')).toBeInTheDocument();
});

test('once loaded with no fixtures, Overview shows the structure strip plus the honest pre-draw line', async () => {
  renderAt('uefa.champions');
  expect(await screen.findByText("The draw hasn't been made yet.")).toBeInTheDocument();
  // Structure strip renders immediately from registry config, independent of fetch.
  expect(screen.getByText('league phase')).toBeInTheDocument();
});

// --- fixture context suppression (spec §13.12 — the page itself is the context) ---

test('the Fixtures tab renders FixtureRow with showContext={false}, since the page is the context', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    events: [{
      id: 'e1', date: '2026-08-22T14:00:00Z', status: { type: { name: 'STATUS_SCHEDULED' } },
      competitions: [{ competitors: [
        { homeAway: 'home', team: { id: 'cel', displayName: 'Celtic' } },
        { homeAway: 'away', team: { id: 'abd', displayName: 'Aberdeen' } },
      ] }],
    }],
  }), { status: 200 })));
  renderAt('sco.1');
  await user.click(screen.getByRole('button', { name: 'Fixtures' }));
  await screen.findByText('Celtic');
  // 'Premiership' is sco.1's shortName — the context line's text, not the
  // page's own h1 (which reads the full 'Scottish Premiership' name).
  expect(screen.queryByText('Premiership')).not.toBeInTheDocument();
});
