// Cheap wiring assertions for the team page's replay-the-draw link (spec
// §13.15) — the pure grouping logic lives in teamFixtures.js
// (phaseReplayGroups), tested directly there; this file only checks
// TeamScreen renders what that returns, in the Season section header area.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest'; // vi.mock() hoisting needs vi imported this way, not the ambient global
import { usePrefs, CELTIC } from '../../store/prefs.js';

// PlayerSheet (mounted at TeamScreen's root, sheet-first consistency,
// Aug 2026) fetches via usePlayer internally — mocked here the same way
// MatchRoom.test.jsx mocks it, so these tests don't need a
// QueryClientProvider.
vi.mock('../../data/queries.js', () => ({
  useTeams: vi.fn(() => ({ isLoading: false, data: undefined })),
  useAllSeasonFixtures: vi.fn(() => []),
  useSquad: vi.fn(() => ({ isLoading: false, isError: false, data: undefined })),
  usePlayer: vi.fn(() => ({ bio: null, stats: null, isLoading: false, isError: false })),
  // The team sheet's lineup fetch (task 3, squad-visual) — same shape as
  // MatchRoom's useMatchDetail mock (isLoading/data), defaulting to "no
  // detail yet" so every existing test (none of which mock it explicitly)
  // keeps landing on SquadBoard's bands fallback, same as before this hook
  // existed.
  useMatchDetail: vi.fn(() => ({ isLoading: false, isError: false, data: undefined })),
}));

import TeamScreen, { matchStarters } from './TeamScreen.jsx';
import { useTeams, useAllSeasonFixtures, useSquad, usePlayer, useMatchDetail } from '../../data/queries.js';

// Every shirt button's accessible name is "<number> · <name>" (task 3
// review — the number was aria-hidden before, so it never reached the a11y
// tree at all).
const lbl = (name, shirt) => `${shirt ?? '—'} · ${name}`;

const side = (teamId, name, over = {}) =>
  ({ teamId, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase(), colour: null, ...over });
const fx = (id, compId, round, kickoff, home, away, status = 'scheduled') =>
  ({ id, compId, kickoff, status, minute: null, round, venue: null, home, away });

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({ followed: { [CELTIC.id]: CELTIC } });
  useTeams.mockImplementation(() => ({ isLoading: false, data: undefined }));
  useSquad.mockImplementation(() => ({ isLoading: false, isError: false, data: undefined }));
  useAllSeasonFixtures.mockImplementation(() => []);
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: false });
  useMatchDetail.mockImplementation(() => ({ isLoading: false, isError: false, data: undefined }));
});

// Feeds every one of the 13 registry comps a fixture list (default empty)
// keyed by compId — TeamScreen queries useAllSeasonFixtures(COMPETITIONS),
// so every comp needs a settled result, not just the one under test.
function stubSeasons(fixturesByCompId) {
  useAllSeasonFixtures.mockImplementation(comps => comps.map(c => ({
    isLoading: false, isSuccess: true, isError: false,
    data: { fixtures: fixturesByCompId[c.id] ?? [], asOf: null },
  })));
}

function renderAt(compId, teamId) {
  return render(
    <MemoryRouter initialEntries={[`/team/${compId}/${teamId}`]}>
      <Routes>
        <Route path="team/:compId/:teamId" element={<TeamScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

test('a club with 2+ phase-round fixtures in a comp gets a replay link to the opponents draw route', () => {
  const celtic = side('256', 'Celtic');
  const fixtures = [
    fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    fx('f2', 'uefa.champions', 'league-phase', '2026-09-02T15:00:00Z', side('o2', 'Opponent 2'), celtic),
  ];
  stubSeasons({ 'uefa.champions': fixtures });

  renderAt('uefa.champions', '256');

  expect(screen.getByRole('link', { name: 'Replay the League Phase draw' }))
    .toHaveAttribute('href', '/draw/uefa.champions/league-phase/256');
});

test('a club with only 1 phase-round fixture gets no replay link', () => {
  const celtic = side('256', 'Celtic');
  const fixtures = [
    fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
  ];
  stubSeasons({ 'uefa.champions': fixtures });

  renderAt('uefa.champions', '256');

  expect(screen.queryByRole('link', { name: /Replay the/ })).not.toBeInTheDocument();
});

test('a club with no phase-round fixtures (only knockout ones) gets no replay link', () => {
  const celtic = side('256', 'Celtic');
  const fixtures = [
    fx('f1', 'sco.tennents', 'fourth-round', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    fx('f2', 'sco.tennents', 'fifth-round', '2026-09-08T15:00:00Z', celtic, side('o2', 'Opponent 2')),
  ];
  stubSeasons({ 'sco.tennents': fixtures });

  renderAt('sco.tennents', '256');

  expect(screen.queryByRole('link', { name: /Replay the/ })).not.toBeInTheDocument();
});

test('a club with qualifying phase fixtures in two comps gets one replay link each', () => {
  const celtic = side('256', 'Celtic');
  const championsFixtures = [
    fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    fx('f2', 'uefa.champions', 'league-phase', '2026-09-02T15:00:00Z', side('o2', 'Opponent 2'), celtic),
  ];
  const challengeFixtures = [
    fx('f3', 'sco.challenge', 'league-phase', '2026-08-01T15:00:00Z', celtic, side('o3', 'Opponent 3')),
    fx('f4', 'sco.challenge', 'league-phase', '2026-08-08T15:00:00Z', side('o4', 'Opponent 4'), celtic),
  ];
  stubSeasons({ 'uefa.champions': championsFixtures, 'sco.challenge': challengeFixtures });

  renderAt('uefa.champions', '256');

  // Two comps both resolve to the 'League Phase' label, so both links
  // share an accessible name — asserted together, each keyed off ITS OWN
  // compId in the href, even though the page itself was opened via
  // uefa.champions.
  const links = screen.getAllByRole('link', { name: 'Replay the League Phase draw' });
  expect(links.map(l => l.getAttribute('href')).sort()).toEqual([
    '/draw/sco.challenge/league-phase/256',
    '/draw/uefa.champions/league-phase/256',
  ]);
});

// --- squad rows open the player sheet (sheet-first consistency, Aug 2026):
// every player tap opens PlayerSheet; the full page is reached only via the
// sheet's expanded "Open as page →" link (or a direct URL). ---

test('a squad row is a button (not a link) that opens the player sheet', async () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' }] },
  }));
  usePlayer.mockReturnValue({
    bio: { id: 'p1', name: 'Kasper Høgh', position: 'Forward', shirt: '9', age: 24, nationality: 'Denmark' },
    stats: { appearances: 10, minutes: 900, goals: 3 },
    isLoading: false, isError: false,
  });

  renderAt('sco.1', '256');

  expect(screen.queryByRole('link', { name: /Kasper Høgh/ })).not.toBeInTheDocument();
  const row = screen.getByRole('button', { name: lbl('Kasper Høgh', '9') });

  await userEvent.click(row);

  await userEvent.click(screen.getByRole('button', { name: 'Full profile →' }));
  expect(screen.getByRole('link', { name: 'Open as page →' })).toHaveAttribute('href', '/player/sco.1/p1');
});

// --- home-league hotfix (Aug 2026): useSquad resolves squads under a
// fallback league and reports resolvedCompId; the sheet's comp (and so its
// Full profile link, and the stats it fetches with) key off that, not the
// route comp. ---

test('a squad row opens the sheet under the resolved league, not the route comp, when they differ', async () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'uefa.champions': [fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' }], resolvedCompId: 'sco.1' },
  }));
  usePlayer.mockReturnValue({
    bio: { id: 'p1', name: 'Kasper Høgh', position: 'Forward', shirt: '9', age: 24, nationality: 'Denmark' },
    stats: { appearances: 10, minutes: 900, goals: 3 },
    isLoading: false, isError: false,
  });

  renderAt('uefa.champions', '256');

  await userEvent.click(screen.getByRole('button', { name: lbl('Kasper Høgh', '9') }));

  await userEvent.click(screen.getByRole('button', { name: 'Full profile →' }));
  expect(screen.getByRole('link', { name: 'Open as page →' })).toHaveAttribute('href', '/player/sco.1/p1');
});

// --- the scout (spec §13.20): when useSquad resolves a foreign club's
// squad under a DISCOVERED domestic league (discovered: true), a line
// above the Squad section names it — and the player sheet's synthetic comp
// descriptor lets it work even though the discovered slug has no registry
// entry. Never for a domestic resolution (discovered false/undefined). ---

test('a discovered foreign club renders the scout line with the full record above the squad section', () => {
  const opponent = side('4411', 'Sturm Graz');
  stubSeasons({
    'uefa.champions': [
      fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', opponent, side('o1', 'Opponent 1')),
    ],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: {
      players: [{ id: 'p1', name: 'Foreign Player', shirt: '9', position: 'Forward' }],
      resolvedCompId: 'aut.1', discovered: true, resolvedLeagueName: 'Austrian Bundesliga',
      record: { played: 3, wins: 3, draws: 0, losses: 0, points: 9 },
    },
  }));

  renderAt('uefa.champions', '4411');

  expect(screen.getByText('Won 3 of 3 in the Austrian Bundesliga this season · 9 points')).toBeInTheDocument();
});

test('a discovered foreign club with a null record falls back to the plain league line', () => {
  const opponent = side('4411', 'Sturm Graz');
  stubSeasons({
    'uefa.champions': [
      fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', opponent, side('o1', 'Opponent 1')),
    ],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: {
      players: [{ id: 'p1', name: 'Foreign Player', shirt: '9', position: 'Forward' }],
      resolvedCompId: 'aut.1', discovered: true, resolvedLeagueName: 'Austrian Bundesliga',
      record: null,
    },
  }));

  renderAt('uefa.champions', '4411');

  expect(screen.getByText('They play in the Austrian Bundesliga.')).toBeInTheDocument();
  expect(screen.queryByText(/^Won /)).not.toBeInTheDocument();
});

test('a discovered foreign club with a partial record (wins underivable) falls back to the plain league line', () => {
  const opponent = side('4411', 'Sturm Graz');
  stubSeasons({
    'uefa.champions': [
      fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', opponent, side('o1', 'Opponent 1')),
    ],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: {
      players: [{ id: 'p1', name: 'Foreign Player', shirt: '9', position: 'Forward' }],
      resolvedCompId: 'aut.1', discovered: true, resolvedLeagueName: 'Austrian Bundesliga',
      record: { played: 3, wins: null, draws: null, losses: 0, points: 10 },
    },
  }));

  renderAt('uefa.champions', '4411');

  expect(screen.getByText('They play in the Austrian Bundesliga.')).toBeInTheDocument();
});

test('a domestic squad resolution never renders the scout line, discovered or not set', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' }], resolvedCompId: 'sco.1' },
  }));

  renderAt('sco.1', '256');

  expect(screen.queryByText(/They play in the/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Won /)).not.toBeInTheDocument();
});

test('a club that resolves under a fallback league (sco.1, discovered undefined) via a UEFA route also gets no scout line', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'uefa.champions': [
      fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    ],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' }], resolvedCompId: 'sco.1' },
  }));

  renderAt('uefa.champions', '256');

  expect(screen.queryByText(/They play in the/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Won /)).not.toBeInTheDocument();
});

test('a discovered foreign squad shirt opens the sheet with a synthetic comp descriptor (id/name/source, no registry entry)', async () => {
  const opponent = side('4411', 'Sturm Graz');
  stubSeasons({
    'uefa.champions': [
      fx('f1', 'uefa.champions', 'league-phase', '2026-09-01T15:00:00Z', opponent, side('o1', 'Opponent 1')),
    ],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: {
      players: [{ id: 'p1', name: 'Foreign Player', shirt: '9', position: 'Forward' }],
      resolvedCompId: 'aut.1', discovered: true, resolvedLeagueName: 'Austrian Bundesliga',
      record: { played: 3, wins: 3, draws: 0, losses: 0, points: 9 },
    },
  }));
  usePlayer.mockReturnValue({
    bio: { id: 'p1', name: 'Foreign Player', position: 'Forward', shirt: '9', age: 24, nationality: 'Austria' },
    stats: { appearances: 3, minutes: 270, goals: 1 },
    isLoading: false, isError: false,
  });

  renderAt('uefa.champions', '4411');

  await userEvent.click(screen.getByRole('button', { name: lbl('Foreign Player', '9') }));

  // byId('aut.1') is undefined (no registry entry for a foreign slug) —
  // the synthetic descriptor is what usePlayer actually gets called with.
  const lastCallArgs = usePlayer.mock.calls.at(-1);
  expect(lastCallArgs[0]).toEqual({ id: 'aut.1', name: 'Austrian Bundesliga', source: 'espn' });
  expect(lastCallArgs[1]).toBe('p1');

  await userEvent.click(screen.getByRole('button', { name: 'Full profile →' }));
  expect(screen.getByRole('link', { name: 'Open as page →' })).toHaveAttribute('href', '/player/aut.1/p1');
});

test('an empty squad (resolved through every fallback, still zero players) shows the distinct unavailable line', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [], resolvedCompId: null },
  }));

  renderAt('sco.1', '256');

  expect(screen.getByText('Squad details unavailable.')).toBeInTheDocument();
  // Distinct from the BBC hasSquads:false line, which never applies here.
  expect(screen.queryByText(/aren't published for/)).not.toBeInTheDocument();
});

// --- the team sheet (squad-visual branch, Aug 2026, task 3): the squad
// section is now SquadBoard — a pitch when the last match's lineup is
// known, bands (grouped by position, no player ever dropped) otherwise.
// Full bucketing/pitch/rail/formation behaviour is unit-tested directly
// against SquadBoard (SquadBoard.test.jsx); these are wiring checks only:
// TeamScreen resolves the last fixture's lineup and hands SquadBoard the
// right props, and every degraded line keeps working underneath it. ---

const mixedSquad = [
  { id: 'g1', name: 'Keeper One', shirt: '1', position: 'Goalkeeper' },
  { id: 'd1', name: 'Defender One', shirt: '2', position: 'Defender' },
  { id: 'd2', name: 'Defender Two', shirt: '3', position: 'D' },
  { id: 'm1', name: 'Midfielder One', shirt: '8', position: 'Midfielder' },
  { id: 'f1', name: 'Forward One', shirt: '9', position: 'Forward' },
  { id: 'f2', name: 'Forward Two', shirt: null, position: 'F' },
  { id: 'x1', name: 'Mystery Player', shirt: '99', position: null },
];

test('no lineup available: the squad renders as bands, every player shown, unknown positions never dropped', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({ isLoading: false, isError: false, data: { players: mixedSquad } }));

  renderAt('sco.1', '256');

  for (const p of mixedSquad) {
    expect(screen.getByRole('button', { name: lbl(p.name, p.shirt) })).toBeInTheDocument();
  }
});

test('a squad row is a button with a "<number> · <name>" aria-label and a club-coloured shirt icon', () => {
  const celtic = side('256', 'Celtic', { colour: '009921' });
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: { players: [{ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' },
                       { id: 'p2', name: 'No Number', shirt: null, position: 'Forward' }] },
  }));

  renderAt('sco.1', '256');

  const row = screen.getByRole('button', { name: lbl('Kasper Høgh', '9') });
  expect(within(row).getByText('9')).toBeInTheDocument();
  // the shirt fill is the CLUB's colour (team.colour), same for every row.
  expect(row.querySelector('[data-testid="shirt-shape"]')).toHaveAttribute('fill', '#009921');

  const blankRow = screen.getByRole('button', { name: lbl('No Number', null) });
  expect(within(blankRow).getByText('—')).toBeInTheDocument();
});

test('the squad section renders none of the earlier designs’ leftover markup (v1 tile grid, v2 group testids)', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  useSquad.mockImplementation(() => ({ isLoading: false, isError: false, data: { players: mixedSquad } }));

  const { container } = renderAt('sco.1', '256');

  expect(container.querySelector('.grid-cols-4')).not.toBeInTheDocument();
  expect(container.querySelector('[data-testid^="squad-group-"]')).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: /Squad balance/ })).not.toBeInTheDocument();
});

// --- the last match's lineup drives the pitch (task 3's data step) ---

test('a resolved lineup for our club\'s side wires starters into SquadBoard\'s pitch, the rest onto the bench rail', () => {
  const celtic = side('256', 'Celtic');
  const kilmarnock = side('o1', 'Kilmarnock', { shortName: 'Kilmarnock' });
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, kilmarnock, 'ft')],
  });
  useSquad.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: {
      players: [
        { id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' },
        { id: 'p2', name: 'Bench Player', shirt: '20', position: 'Defender' },
      ],
    },
  }));
  useMatchDetail.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: {
      detail: {
        lineups: [
          { homeAway: 'home', players: [{ id: 'p1', name: 'Kasper Høgh', starter: true }] },
          { homeAway: 'away', players: [] },
        ],
      },
    },
  }));

  renderAt('sco.1', '256');

  // No numeral formation claim (task 3 review) — just the plain caption.
  expect(screen.getByText('Last match v Kilmarnock')).toBeInTheDocument();
  expect(screen.getByText('The bench & the rest')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: lbl('Bench Player', '20') })).toBeInTheDocument();
});

// --- a lineup starter with no squad match is never dropped (task 3 review) ---

test('matchStarters: an unmatched lineup starter is synthesised from the lineup entry, not dropped', () => {
  const lineupPlayers = [
    { id: 'p1', name: 'Kasper Høgh', shirt: '9', starter: true },
    { id: 'espn-777', name: 'New Signing', shirt: '77', starter: true },
    { id: 'p2', name: 'Bench Player', shirt: '20', starter: false },
  ];
  const squadPlayers = [
    { id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' },
    { id: 'p2', name: 'Bench Player', shirt: '20', position: 'Defender' },
  ];

  const starters = matchStarters(lineupPlayers, squadPlayers);

  expect(starters).toHaveLength(2); // the two starters, bench excluded
  expect(starters.find(p => p.id === 'p1'))
    .toEqual({ id: 'p1', name: 'Kasper Høgh', shirt: '9', position: 'Forward' });
  expect(starters.find(p => p.id === 'espn-777'))
    .toEqual({ id: 'espn-777', name: 'New Signing', shirt: '77', position: null });
});

test('an XI with one unmatched starter (a signing the squad endpoint hasn\'t caught up on) still renders all 11 shirts on the pitch', () => {
  const celtic = side('256', 'Celtic');
  const kilmarnock = side('o1', 'Kilmarnock', { shortName: 'Kilmarnock' });
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, kilmarnock, 'ft')],
  });
  const squadPlayers = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i + 1}`, name: `Player ${i + 1}`, shirt: String(i + 1),
    position: i === 0 ? 'Goalkeeper' : 'Defender',
  }));
  useSquad.mockImplementation(() => ({ isLoading: false, isError: false, data: { players: squadPlayers } }));
  useMatchDetail.mockImplementation(() => ({
    isLoading: false, isError: false,
    data: {
      detail: {
        lineups: [
          {
            homeAway: 'home',
            players: [
              ...squadPlayers.map(p => ({ id: p.id, name: p.name, shirt: p.shirt, starter: true })),
              { id: 'espn-999', name: 'New Signing', shirt: '77', starter: true }, // 11th, no squad match
            ],
          },
          { homeAway: 'away', players: [] },
        ],
      },
    },
  }));

  renderAt('sco.1', '256');

  const pitchRows = screen.getAllByTestId(/^pitch-row-/);
  const onPitch = pitchRows.flatMap(r => within(r).getAllByRole('button'));
  expect(onPitch).toHaveLength(11);
  expect(screen.getByRole('button', { name: lbl('New Signing', '77') })).toBeInTheDocument();
});

test('a BBC comp (hasSquads false): the degraded line still renders, unaffected by the lineup wiring', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'scottish-league-one': [
      fx('f1', 'scottish-league-one', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1')),
    ],
  });

  renderAt('scottish-league-one', '256');

  expect(screen.getByText("Squad details aren't published for Scottish League One.")).toBeInTheDocument();
});

// --- full-bleed watermark (spec §13.18.1) ---

test('the crest watermark is fixed to the viewport (not clipped by an overflow-hidden main)', () => {
  const celtic = side('256', 'Celtic', { crestUrl: 'https://example.com/crest.png' });
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });

  const { container } = renderAt('sco.1', '256');

  const main = container.querySelector('main');
  expect(main.className).not.toMatch(/overflow-hidden/);
  expect(main.className).toMatch(/relative/);
  // The crest div itself is absolute inside a fixed, column-centred
  // wrapper — the wrapper does the viewport-fixing (so nothing clips at
  // the padded column), the inner max-w-md re-anchors it to the content
  // column on wide screens.
  const crest = container.querySelector('[style*="crest.png"]');
  expect(crest.className).toMatch(/-top-\[140px\]/);
  expect(crest.className).toMatch(/-right-\[140px\]/);
  const wrapper = crest.closest('[aria-hidden]');
  expect(wrapper.className).toMatch(/fixed/);
  expect(wrapper.className).toMatch(/pointer-events-none/);
  expect(wrapper.className).toMatch(/z-0/);
  expect(crest.closest('[class*="max-w-md"]')).not.toBeNull();
});

test('a club with no phase fixtures at all renders the page normally, no replay link', () => {
  const celtic = side('256', 'Celtic');
  stubSeasons({
    'sco.1': [fx('f1', 'sco.1', 'round-1', '2026-08-01T15:00:00Z', celtic, side('o1', 'Opponent 1'))],
  });
  renderAt('sco.1', '256');
  expect(screen.queryByRole('link', { name: /Replay the/ })).not.toBeInTheDocument();
  expect(screen.getByText('Season')).toBeInTheDocument();
});

// --- Next/Last drawer state keying (review fix, spec §13.19.1): FixtureRow
// now owns its own `open` drawer state, so the Next/Last rows need a key on
// the fixture id or React reuses the instance across a refetch that swaps
// which fixture occupies that slot — silently re-pointing an open drawer
// at a different match instead of resetting it closed. ---

test('changing which fixture is "next" (e.g. after a refetch) closes any open drawer rather than re-pointing it', async () => {
  const user = userEvent.setup();
  const celtic = side('256', 'Celtic');
  // Far-future kickoffs so both unambiguously qualify as "next" regardless
  // of the real system clock when this test runs.
  const fixtureA = fx('f1', 'sco.1', null, '2027-01-01T15:00:00Z', celtic, side('o1', 'Opponent 1'));
  const fixtureB = fx('f2', 'sco.1', null, '2027-01-08T15:00:00Z', celtic, side('o2', 'Opponent 2'));
  stubSeasons({ 'sco.1': [fixtureA] });

  const { rerender } = renderAt('sco.1', '256');
  const nextSection = () => screen.getByText('Next').closest('section');

  // sco.1 is an espn hasMatchDetail comp, so the Next row is a drawer
  // toggle — open it.
  await user.click(within(nextSection()).getByRole('button', { expanded: false }));
  expect(within(nextSection()).getByRole('button', { expanded: true })).toBeInTheDocument();

  // A refetch settles on a different fixture for the same "next" slot.
  stubSeasons({ 'sco.1': [fixtureB] });
  rerender(
    <MemoryRouter initialEntries={['/team/sco.1/256']}>
      <Routes>
        <Route path="team/:compId/:teamId" element={<TeamScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  // Keyed on fixture.id, the row remounts fresh rather than reusing the
  // old instance's open state pointed at the wrong match now.
  expect(within(nextSection()).getByRole('button', { expanded: false })).toBeInTheDocument();
  expect(within(nextSection()).queryByRole('button', { expanded: true })).not.toBeInTheDocument();
});
