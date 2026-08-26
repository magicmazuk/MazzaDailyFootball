// Cheap wiring assertions for the cup Overview tab (spec §13.10) — tab
// set/default per comp.type/hasTable, and the season-loading state. The
// FieldBoard component tests carry the real behavioural coverage; this
// file only checks CompetitionScreen wires them in.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import { usePrefs } from '../../store/prefs.js';
import { byId } from '../../domain/competitions.js';
import CompetitionScreen from './CompetitionScreen.jsx';

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 })));
  usePrefs.setState({ seenTies: {} });
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

test('once loaded with no fixtures, Overview shows the blurb plus the honest pre-draw line', async () => {
  const comp = byId('sco.cis');
  renderAt('sco.cis');
  expect(await screen.findByText("The draw hasn't been made yet.")).toBeInTheDocument();
  // The blurb renders immediately from registry config, independent of fetch.
  expect(screen.getByText(comp.blurb)).toBeInTheDocument();
  // No structure-strip artifacts remain — its '›' separator glyph is gone.
  expect(screen.queryByText('›')).not.toBeInTheDocument();
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

// --- round grouping on Fixtures/Results (Release 2.3 §C1) ---

const teamEvent = (id, date, statusName, roundSlug, homeName, awayName) => ({
  id, date, status: { type: { name: statusName } }, season: { slug: roundSlug },
  competitions: [{ competitors: [
    { homeAway: 'home', team: { id: `${id}h`, displayName: homeName } },
    { homeAway: 'away', team: { id: `${id}a`, displayName: awayName } },
  ] }],
});

test('a cup with round-labelled fixtures groups the Fixtures tab by round, ascending, under a heading per round', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    events: [
      teamEvent('qf', '2026-04-01T15:00:00Z', 'STATUS_SCHEDULED', 'quarterfinals', 'Celtic', 'Aberdeen'),
      teamEvent('fr', '2026-02-01T15:00:00Z', 'STATUS_SCHEDULED', 'fourth-round', 'Rangers', 'Hibernian'),
    ],
  }), { status: 200 })));
  renderAt('sco.tennents');
  await user.click(screen.getByRole('button', { name: 'Fixtures' }));
  await screen.findByText('Celtic');
  const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
  expect(headings).toEqual(['Fourth round', 'Quarter-finals']);
});

test('the same cup reverses round order on the Results tab', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    events: [
      teamEvent('qf', '2026-04-01T15:00:00Z', 'STATUS_FULL_TIME', 'quarterfinals', 'Celtic', 'Aberdeen'),
      teamEvent('fr', '2026-02-01T15:00:00Z', 'STATUS_FULL_TIME', 'fourth-round', 'Rangers', 'Hibernian'),
    ],
  }), { status: 200 })));
  renderAt('sco.tennents');
  await user.click(screen.getByRole('button', { name: 'Results' }));
  await screen.findByText('Celtic');
  const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
  expect(headings).toEqual(['Quarter-finals', 'Fourth round']);
});

// --- replay link (spec §8.2, §13.14) ---

test('the Overview tab shows a quiet replay link for the latest round whose ties are all seen', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    events: [
      teamEvent('e1', '2026-02-01T15:00:00Z', 'STATUS_SCHEDULED', 'fourth-round', 'Celtic', 'Aberdeen'),
      teamEvent('e2', '2026-02-01T12:00:00Z', 'STATUS_SCHEDULED', 'fourth-round', 'Rangers', 'Hibernian'),
    ],
  }), { status: 200 })));
  usePrefs.setState({ seenTies: { 'sco.tennents:e1': true, 'sco.tennents:e2': true } });
  renderAt('sco.tennents');
  const link = await screen.findByRole('link', { name: 'Replay the Fourth round draw' });
  expect(link).toHaveAttribute('href', '/draw/sco.tennents/fourth-round');
});

test('no replay link when no round has every tie seen', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    events: [
      teamEvent('e1', '2026-02-01T15:00:00Z', 'STATUS_SCHEDULED', 'fourth-round', 'Celtic', 'Aberdeen'),
      teamEvent('e2', '2026-02-01T12:00:00Z', 'STATUS_SCHEDULED', 'fourth-round', 'Rangers', 'Hibernian'),
    ],
  }), { status: 200 })));
  // Only one of the round's two ties seen — not a fully-revealed round.
  usePrefs.setState({ seenTies: { 'sco.tennents:e1': true } });
  renderAt('sco.tennents');
  await screen.findByText('Celtic');
  expect(screen.queryByRole('link', { name: /Replay the/ })).not.toBeInTheDocument();
});

test('the replay link picks the LATEST fully-seen round when more than one qualifies', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    events: [
      teamEvent('e1', '2026-02-01T15:00:00Z', 'STATUS_SCHEDULED', 'fourth-round', 'Celtic', 'Aberdeen'),
      teamEvent('e2', '2026-02-01T12:00:00Z', 'STATUS_SCHEDULED', 'fourth-round', 'Rangers', 'Hibernian'),
      teamEvent('e3', '2026-04-01T15:00:00Z', 'STATUS_SCHEDULED', 'quarterfinals', 'Celtic', 'Rangers'),
      teamEvent('e4', '2026-04-01T12:00:00Z', 'STATUS_SCHEDULED', 'quarterfinals', 'Aberdeen', 'Hibernian'),
    ],
  }), { status: 200 })));
  usePrefs.setState({
    seenTies: {
      'sco.tennents:e1': true, 'sco.tennents:e2': true,
      'sco.tennents:e3': true, 'sco.tennents:e4': true,
    },
  });
  renderAt('sco.tennents');
  const link = await screen.findByRole('link', { name: 'Replay the Quarter-finals draw' });
  expect(link).toHaveAttribute('href', '/draw/sco.tennents/quarterfinals');
});

// --- motion (spec §13.21): the page's one content block — whichever tab is
// active — rises in on mount, in the same static rise-in-1 slot regardless
// of which tab that happens to be (there's only ever one visible at a
// time, so they share the slot rather than each claiming their own). ---

test('the Overview tab content rises in on mount (.rise-in rise-in-1)', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // never resolves — deterministic loading state
  renderAt('sco.tennents');
  const wrapper = screen.getByText('Loading the field…').closest('.rise-in');
  expect(wrapper).toHaveClass('rise-in-1');
});

test('the Table tab content also rises in the same rise-in-1 slot', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  renderAt('sco.1'); // a league, defaults to Table
  const wrapper = screen.getByText('Loading table…').closest('.rise-in');
  expect(wrapper).toHaveClass('rise-in-1');
});

test('a league carries no displayable round (ESPN season.slug is a year-prefixed season name) and stays flat, unchanged', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    events: [teamEvent('e1', '2026-08-22T14:00:00Z', 'STATUS_SCHEDULED',
      '2026-27-scottish-premiership', 'Celtic', 'Aberdeen')],
  }), { status: 200 })));
  renderAt('sco.1');
  await user.click(screen.getByRole('button', { name: 'Fixtures' }));
  await screen.findByText('Celtic');
  expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
});

// --- the fantasy ladder (spec §13.40) ---

const FPL_INDEX = {
  teams: [{ id: 1, name: 'Arsenal' }],
  players: [{ code: 1, web: 'Saka', team: 1, points: 9, event: 4 }],
};

const stubFplFetch = () => vi.stubGlobal('fetch', vi.fn(async url => {
  if (String(url).includes('/fpl/index')) {
    return new Response(JSON.stringify(FPL_INDEX), { status: 200 });
  }
  return new Response(JSON.stringify({ events: [] }), { status: 200 });
}));

test('the EPL page carries the league-wide fantasy ladder under its table', async () => {
  stubFplFetch();
  renderAt('eng.1');
  expect(await screen.findByText('The fantasy ladder')).toBeInTheDocument();
  expect(await screen.findByText('Saka')).toBeInTheDocument();
});

test('no other league carries a ladder — the data is EPL-only by reality', async () => {
  stubFplFetch();
  renderAt('sco.1');
  await screen.findByText(/Table|Loading table/);
  expect(screen.queryByText('The fantasy ladder')).not.toBeInTheDocument();
});
