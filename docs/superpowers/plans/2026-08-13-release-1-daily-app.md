# MazzaDailyFootball Release 1 (The Daily App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the daily-use football app — Today screen, all 13 competitions' fixtures/results, league tables, team pages, match room, follow/unfollow — on the free ESPN+BBC data pipeline, in the Broadsheet design language.

**Architecture:** Vite/React SPA on Vercel. Two serverless proxy functions (`/api/espn`, `/api/bbc`) put Vercel's edge cache in front of every upstream call and keep a last-known-good fallback. Two source adapters translate provider JSON into one domain model; tables for BBC-sourced leagues are computed from results. Presentational components take props (testable); thin screen components wire TanStack Query hooks to them.

**Tech Stack:** Vite 8 · React 19 · TailwindCSS 3.4 · React Router 6.30 · TanStack Query 5 · Zustand 4.5 · Vitest 4 + Testing Library (jsdom) · Vercel serverless functions. JavaScript, not TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-13-mazza-daily-football-design.md` — read §3 (data), §5 (domain model), §6 (design system) before starting.

## Global Constraints

- **JavaScript only.** No TypeScript anywhere.
- **Never attach a browser User-Agent to ESPN requests** — ESPN returns 403 to spoofed UAs; the default fetch UA works (spec §3.5).
- **Never parse `event.name`** for home/away (it reads "Away at Home"); always use `competitors[].homeAway`.
- **Zero keys, zero env vars.** If a task seems to need a secret, the task is wrong.
- **Design tokens (spec §6):** paper `#FBF9F5`, ink `#17140F`, accent `#A11B1B`, rule `#E5DFD3`, muted `#8A8175`, drawer `#F4F0E7`. Serif: Georgia stack. Labels: system-ui uppercase, letter-spaced. Numerals: tabular.
- **Qualification zones are 2px margin ticks, never row backgrounds.**
- **Every degraded case renders a designed one-line explanation, never a blank area.**
- **Celtic (ESPN team id `256`) is permanently followed and cannot be unfollowed.**
- **Persistence is `localStorage` only**, key `mdf-prefs`.
- **Season constants** live in one place (`src/domain/competitions.js`): 2026-27 season, ESPN range `20260701-20270630`, ESPN standings year `2026`, BBC range `2026-07-01`..`2027-06-30`.
- **Tests must not hit the network.** Adapters/proxies are tested against inline JSON modelled on verified real responses; `fetch` is stubbed.
- **Do not put test files under `api/`** — Vercel deploys every file there as a function. Proxy tests live in `src/test/api/`.
- **Windows note:** run everything with `npm`/`node` from PATH; Python scripts use `py`. Vitest is configured with `pool: 'forks'` (Node-on-Windows worker issue seen in the World Cup project).
- Commit after every task with the exact message given; `git add` only the files the task names.

## File Map

```
api/espn.js                      ESPN allowlist proxy: edge cache + last-known-good
api/bbc.js                       BBC proxy (2 tournaments): same pattern
vercel.json                      rewrites: /api/espn/* path→query; SPA fallback
vite.config.js                   react plugin + /api dev shim + vitest config
tailwind.config.js               Broadsheet tokens
index.html, src/main.jsx         entry; QueryClient + Router providers
src/index.css                    Tailwind + base styles
src/App.jsx                      route table
src/domain/competitions.js       SEASON + 13-competition registry + zones + groups
src/domain/monogram.js           monogram(name) for crestless clubs
src/domain/table.js              computeTable(fixtures) for BBC leagues
src/domain/form.js               formGuide(fixtures, teamId)
src/data/espn.js                 adaptScoreboard/adaptStandings/adaptTeams/adaptSquad/adaptSummary
src/data/bbc.js                  adaptBbcFixtures
src/data/client.js               espnUrl/bbcUrl/getJson (reads x-lkg-at header)
src/data/queries.js              TanStack Query hooks + pollMs live-gating
src/store/prefs.js               Zustand+persist: followed clubs, hidden competitions
src/ui/Crest.jsx                 crest img → monogram disc fallback
src/ui/SectionLabel.jsx          red/muted uppercase section heading with rule
src/ui/StatusWord.jsx            kickoff time / LIVE 63′ / FT / P–P
src/ui/FixtureRow.jsx            two-line fixture row used by every list
src/ui/AppShell.jsx              container + 3-tab bottom nav
src/features/today/partition.js  partitionToday(fixtures, followedIds, now)
src/features/today/TodayView.jsx presentational Today
src/features/today/TodayScreen.jsx  wiring
src/features/competitions/CompetitionsScreen.jsx  grouped index
src/features/competition/zones.js     zoneFor/ZONE_META helpers
src/features/competition/LeagueTable.jsx  T1 table: expand, split, ticks
src/features/competition/CompetitionScreen.jsx  Table|Fixtures|Results tabs
src/features/team/teamFixtures.js     pure next/last/season filter
src/features/team/TeamScreen.jsx      header, next/last, fixtures, squad
src/features/match/MatchRoom.jsx      presentational match room
src/features/match/MatchScreen.jsx    wiring + degraded case
src/features/clubs/searchTeams.js     pure search/dedupe
src/features/clubs/ClubsScreen.jsx    followed, search, visibility
src/test/setup.js                jest-dom
src/test/api/espn.test.js        proxy tests (fake req/res, stubbed fetch)
src/test/api/bbc.test.js
```

Presentational/wiring split is the testing strategy: pure functions and presentational components get real tests; screen wiring stays thin and untested.

---

### Task 1: Scaffold

**Files:**
- Create: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/index.css`, `src/ui/AppShell.jsx`, `src/test/setup.js`, `src/test/smoke.test.jsx`

**Interfaces:**
- Produces: running dev server, running test runner, route table with placeholder screens later tasks replace, Tailwind tokens `paper/ink/accent/rule/muted/drawer`, font families `font-serif`/`font-sans`.

- [ ] **Step 1: package.json**

```json
{
  "name": "mazzadailyfootball",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.100.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^6.30.0",
    "zustand": "^4.5.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.0",
    "@vitejs/plugin-react": "^6.0.0",
    "autoprefixer": "^10.4.20",
    "jsdom": "^29.0.0",
    "postcss": "^8.5.0",
    "tailwindcss": "^3.4.19",
    "vite": "^8.0.0",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 2: configs**

`vite.config.js` (the `apiShim` middleware mounts the Vercel functions in dev so `/api/*` works without `vercel dev`; the handlers don't exist until Tasks 6–7, so the shim 404s gracefully until then):

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

function apiShim() {
  return {
    name: 'api-shim',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const mount = ['/api/espn', '/api/bbc'].find(p => req.url.startsWith(p));
        if (!mount) return next();
        const file = `${mount.slice(1)}.js`; // api/espn.js
        if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not built yet'); }
        const { default: handler } = await server.ssrLoadModule(`/${file}`);
        return handler(req, res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiShim()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    pool: 'forks',
  },
});
```

`tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FBF9F5', ink: '#17140F', accent: '#A11B1B',
        rule: '#E5DFD3', muted: '#8A8175', drawer: '#F4F0E7',
      },
      fontFamily: {
        serif: ['Georgia', '"Iowan Old Style"', '"Times New Roman"', 'serif'],
        sans: ['system-ui', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

`postcss.config.js`:

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`index.html`:

```html
<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#FBF9F5" />
    <title>MazzaDailyFootball</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-paper text-ink font-serif antialiased;
}
```

`src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: entry, shell, routes**

`src/ui/AppShell.jsx`:

```jsx
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  ['/', 'Today'],
  ['/competitions', 'Competitions'],
  ['/clubs', 'Clubs'],
];

export default function AppShell() {
  return (
    <div className="min-h-screen max-w-md mx-auto px-5 pt-7 pb-24">
      <Outlet />
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-paper/95 backdrop-blur border-t border-rule flex">
        {TABS.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 py-4 text-center font-sans text-[10px] uppercase tracking-[.18em] ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

`src/App.jsx` (placeholder screens are real components; Tasks 11–15 replace them):

```jsx
import { Routes, Route } from 'react-router-dom';
import AppShell from './ui/AppShell.jsx';

const Stub = ({ name }) => <p className="text-muted">{name}</p>;

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Stub name="Today" />} />
        <Route path="competitions" element={<Stub name="Competitions" />} />
        <Route path="competition/:compId" element={<Stub name="Competition" />} />
        <Route path="clubs" element={<Stub name="Clubs" />} />
        <Route path="team/:compId/:teamId" element={<Stub name="Team" />} />
        <Route path="match/:compId/:eventId" element={<Stub name="Match" />} />
      </Route>
    </Routes>
  );
}
```

`src/main.jsx`:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: smoke test**

`src/test/smoke.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App.jsx';

test('renders the three tabs', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByText('Today', { selector: 'a' })).toBeInTheDocument();
  expect(screen.getByText('Competitions', { selector: 'a' })).toBeInTheDocument();
  expect(screen.getByText('Clubs', { selector: 'a' })).toBeInTheDocument();
});
```

- [ ] **Step 5: install and verify**

Run: `npm install` then `npm run test:run`
Expected: 1 test file, 1 passed.
Run: `npm run dev` briefly; open http://localhost:5173 — paper-cream page, "Today" text, three tabs at the bottom. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js tailwind.config.js postcss.config.js index.html src
git commit -m "feat: scaffold Vite/React app with Broadsheet tokens and 3-tab shell"
```

---

### Task 2: Competition registry and monogram

**Files:**
- Create: `src/domain/competitions.js`, `src/domain/monogram.js`
- Test: `src/domain/monogram.test.js`, `src/domain/competitions.test.js`

**Interfaces:**
- Produces: `SEASON` `{label, espnRange, espnYear, bbcStart, bbcEnd}`; `COMPETITIONS` array (shape below); `byId(id) → competition|undefined`; `COMPETITION_GROUPS` `[ [groupName, competitions[]] ]`; `monogram(name) → string` (1–2 chars, uppercase).
- Competition shape: `{ id, name, shortName, country: 'Scotland'|'England'|'Europe', type: 'league'|'cup', source: 'espn'|'bbc', hasTable: boolean|'computed', hasSquads: boolean, hasMatchDetail: boolean, splitAfter?: number, zones: {pos: zoneKey} }`. Zone keys: `ucl uecl po rel promo adv`.

- [ ] **Step 1: failing tests**

`src/domain/monogram.test.js`:

```js
import { monogram } from './monogram.js';

test('two-word clubs take both initials', () => {
  expect(monogram('Auchinleck Talbot')).toBe('AT');
  expect(monogram('Wick Academy')).toBe('WA');
});

test("apostrophes don't break the second word", () => {
  expect(monogram("Banks O'Dee")).toBe('BO');
});

test('single-word clubs take the first two letters', () => {
  expect(monogram('Celtic')).toBe('CE');
});

test('empty input degrades to a question mark', () => {
  expect(monogram('')).toBe('?');
});
```

`src/domain/competitions.test.js`:

```js
import { COMPETITIONS, byId, COMPETITION_GROUPS, SEASON } from './competitions.js';

test('registry holds exactly the 13 competitions of spec §3.1', () => {
  expect(COMPETITIONS).toHaveLength(13);
  expect(COMPETITIONS.filter(c => c.source === 'bbc').map(c => c.id)).toEqual([
    'scottish-league-one', 'scottish-league-two',
  ]);
});

test('byId finds the Premiership with split and zones', () => {
  const p = byId('sco.1');
  expect(p.splitAfter).toBe(6);
  expect(p.zones[1]).toBe('ucl');
  expect(p.zones[12]).toBe('rel');
  expect(p.hasSquads).toBe(true);
});

test('BBC leagues compute their tables and carry no squads or match detail', () => {
  const l1 = byId('scottish-league-one');
  expect(l1.hasTable).toBe('computed');
  expect(l1.hasSquads).toBe(false);
  expect(l1.hasMatchDetail).toBe(false);
});

test('UEFA league phases mark 1-8 advancing and 9-24 play-off', () => {
  const ucl = byId('uefa.champions');
  expect(ucl.hasTable).toBe(true);
  expect(ucl.zones[8]).toBe('adv');
  expect(ucl.zones[9]).toBe('po');
  expect(ucl.zones[24]).toBe('po');
  expect(ucl.zones[25]).toBeUndefined();
});

test('groups are Scotland, England, Europe in order', () => {
  expect(COMPETITION_GROUPS.map(([name]) => name)).toEqual(['Scotland', 'England', 'Europe']);
});

test('season constants are the 2026-27 season', () => {
  expect(SEASON.espnRange).toBe('20260701-20270630');
  expect(SEASON.espnYear).toBe(2026);
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/domain`
Expected: FAIL — cannot find module `./monogram.js` / `./competitions.js`.

- [ ] **Step 3: implement**

`src/domain/monogram.js`:

```js
// Serif monogram for clubs the feeds carry without a crest (spec §8.5).
// "Auchinleck Talbot" → AT, "Banks O'Dee" → BO, "Celtic" → CE.
export function monogram(name) {
  const words = (name ?? '').replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
```

`src/domain/competitions.js`:

```js
// The 13 competitions of spec §3.1, plus the season constants (Global
// Constraints). Zone maps drive the 2px margin ticks in league tables —
// they encode competition rules that can change season to season, so
// they are config, deliberately editable, not derived.

export const SEASON = {
  label: '2026-27',
  espnRange: '20260701-20270630',
  espnYear: 2026,
  bbcStart: '2026-07-01',
  bbcEnd: '2027-06-30',
};

const range = (from, to, zone) =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, zone]));

const league = { type: 'league', hasTable: true, hasSquads: true, hasMatchDetail: true };
const cup = { type: 'cup', hasTable: false, hasSquads: true, hasMatchDetail: true, zones: {} };

export const COMPETITIONS = [
  { ...league, id: 'sco.1', name: 'Scottish Premiership', shortName: 'Premiership',
    country: 'Scotland', source: 'espn', splitAfter: 6,
    zones: { 1: 'ucl', 2: 'uecl', 3: 'uecl', 11: 'po', 12: 'rel' } },
  { ...league, id: 'sco.2', name: 'Scottish Championship', shortName: 'Championship',
    country: 'Scotland', source: 'espn',
    zones: { 1: 'promo', 9: 'po', 10: 'rel' } },
  { ...league, id: 'scottish-league-one', name: 'Scottish League One', shortName: 'League One',
    country: 'Scotland', source: 'bbc', hasTable: 'computed', hasSquads: false, hasMatchDetail: false,
    zones: { 1: 'promo', 9: 'po', 10: 'rel' } },
  { ...league, id: 'scottish-league-two', name: 'Scottish League Two', shortName: 'League Two',
    country: 'Scotland', source: 'bbc', hasTable: 'computed', hasSquads: false, hasMatchDetail: false,
    zones: { 1: 'promo', 9: 'po' } },
  { ...cup, id: 'sco.tennents', name: 'Scottish Cup', shortName: 'Scottish Cup',
    country: 'Scotland', source: 'espn' },
  { ...cup, id: 'sco.cis', name: 'Scottish League Cup', shortName: 'League Cup',
    country: 'Scotland', source: 'espn' },
  { ...cup, id: 'sco.challenge', name: 'Scottish Challenge Cup', shortName: 'Challenge Cup',
    country: 'Scotland', source: 'espn' },
  { ...league, id: 'eng.1', name: 'English Premier League', shortName: 'Premier League',
    country: 'England', source: 'espn',
    zones: { ...range(1, 4, 'ucl'), 5: 'uecl', ...range(18, 20, 'rel') } },
  { ...cup, id: 'eng.fa', name: 'FA Cup', shortName: 'FA Cup',
    country: 'England', source: 'espn' },
  { ...cup, id: 'eng.league_cup', name: 'Carabao Cup', shortName: 'Carabao Cup',
    country: 'England', source: 'espn' },
  { ...cup, id: 'uefa.champions', name: 'UEFA Champions League', shortName: 'Champions League',
    country: 'Europe', source: 'espn', hasTable: true,
    zones: { ...range(1, 8, 'adv'), ...range(9, 24, 'po') } },
  { ...cup, id: 'uefa.europa', name: 'UEFA Europa League', shortName: 'Europa League',
    country: 'Europe', source: 'espn', hasTable: true,
    zones: { ...range(1, 8, 'adv'), ...range(9, 24, 'po') } },
  { ...cup, id: 'uefa.europa.conf', name: 'UEFA Conference League', shortName: 'Conference League',
    country: 'Europe', source: 'espn', hasTable: true,
    zones: { ...range(1, 8, 'adv'), ...range(9, 24, 'po') } },
];

export const byId = id => COMPETITIONS.find(c => c.id === id);

export const COMPETITION_GROUPS = ['Scotland', 'England', 'Europe'].map(country => [
  country,
  COMPETITIONS.filter(c => c.country === country),
]);
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/domain`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: competition registry (13 comps, zones, split) and monogram util"
```

---

### Task 3: ESPN adapter

**Files:**
- Create: `src/data/espn.js`
- Test: `src/data/espn.test.js`

**Interfaces:**
- Consumes: `monogram(name)` from Task 2.
- Produces:
  - `adaptScoreboard(json, compId) → Fixture[]`
  - `adaptStandings(json) → TableRow[]`
  - `adaptTeams(json) → Team[]`
  - `adaptSquad(json) → Player[]`
  - `adaptSummary(json) → { events: MatchEvent[], teamStats: TeamStats[]|null, lineups: Lineup[] }`
- `Fixture`: `{ id, compId, kickoff, status: 'scheduled'|'live'|'ft'|'postponed'|'canceled', minute, round, venue, home: Side, away: Side }`; `Side`: `{ teamId, name, shortName, crestUrl, monogram, colour, score: number|null }`.
- `TableRow`: `{ teamId, name, crestUrl, monogram, position, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points, deduction }`.
- `Team`: `{ id, name, shortName, crestUrl, monogram, colour }`. `Player`: `{ id, name, position, shirt, age, nationality }`.
- `MatchEvent`: `{ minute, type, player, teamId }`. `TeamStats`: `{ teamId, name, stats: {statName: displayValue} }`. `Lineup`: `{ homeAway, players: [{name, shirt, starter, position}] }`.

- [ ] **Step 1: failing tests**

`src/data/espn.test.js` — the inline JSON mirrors verified real responses; the first test encodes the "Away at Home" trap from spec §3.5:

```js
import {
  adaptScoreboard, adaptStandings, adaptTeams, adaptSquad, adaptSummary,
} from './espn.js';

const scoreboard = {
  events: [
    {
      id: '401878415',
      date: '2026-08-01T14:00Z',
      name: 'St Mirren at Falkirk', // "Away at Home" — never parse this
      season: { slug: 'regular-season' },
      status: { type: { name: 'STATUS_FULL_TIME', state: 'post', completed: true } },
      competitions: [{
        venue: { fullName: 'Falkirk Stadium' },
        competitors: [
          { homeAway: 'home', score: '1',
            team: { id: '254', displayName: 'Falkirk', abbreviation: 'FALK',
                    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/254.png', color: '000099' } },
          { homeAway: 'away', score: '0',
            team: { id: '250', displayName: 'St Mirren', abbreviation: 'STM',
                    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/250.png', color: '000000' } },
        ],
      }],
    },
    {
      id: '2', date: '2026-08-22T14:00Z', name: 'B at A',
      season: { slug: 'fourth-round' },
      status: { type: { name: 'STATUS_FIRST_HALF', state: 'in', completed: false }, displayClock: "37'" },
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '2', team: { id: '10603', displayName: 'Auchinleck Talbot' } },
          { homeAway: 'away', score: '0', team: { id: '256', displayName: 'Celtic', logo: 'x.png' } },
        ],
      }],
    },
    {
      id: '3', date: '2026-08-22T14:00Z', name: 'D at C',
      status: { type: { name: 'STATUS_POSTPONED', state: 'pre', completed: false } },
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '0', team: { id: '256', displayName: 'Celtic' } },
          { homeAway: 'away', score: '0', team: { id: '267', displayName: 'St Johnstone' } },
        ],
      }],
    },
  ],
};

test('scoreboard: home/away from homeAway, never from event.name', () => {
  const [ft] = adaptScoreboard(scoreboard, 'sco.1');
  expect(ft.home.name).toBe('Falkirk');
  expect(ft.away.name).toBe('St Mirren');
  expect(ft.home.score).toBe(1);
  expect(ft.away.score).toBe(0);
  expect(ft.status).toBe('ft');
  expect(ft.round).toBe('regular-season');
  expect(ft.venue).toBe('Falkirk Stadium');
  expect(ft.compId).toBe('sco.1');
});

test('scoreboard: in-play maps to live with a minute; crestless side gets a monogram', () => {
  const live = adaptScoreboard(scoreboard, 'sco.tennents')[1];
  expect(live.status).toBe('live');
  expect(live.minute).toBe("37'");
  expect(live.home.crestUrl).toBeNull();
  expect(live.home.monogram).toBe('AT');
  expect(live.away.crestUrl).toBe('x.png');
});

test('scoreboard: postponed maps to postponed, not scheduled', () => {
  expect(adaptScoreboard(scoreboard, 'sco.1')[2].status).toBe('postponed');
});

const standings = {
  children: [{
    standings: {
      entries: [
        { team: { id: '262', displayName: 'Heart of Midlothian',
                  logos: [{ href: 'hearts.png' }] },
          stats: [
            { name: 'gamesPlayed', value: 38 }, { name: 'wins', value: 24 },
            { name: 'ties', value: 8 }, { name: 'losses', value: 6 },
            { name: 'pointsFor', value: 67 }, { name: 'pointsAgainst', value: 34 },
            { name: 'pointDifferential', value: 33 }, { name: 'points', value: 80 },
            { name: 'deductions', value: 0 }, { name: 'rank', value: 2 },
          ] },
        { team: { id: '256', displayName: 'Celtic', logos: [{ href: 'celtic.png' }] },
          stats: [
            { name: 'gamesPlayed', value: 38 }, { name: 'wins', value: 26 },
            { name: 'ties', value: 4 }, { name: 'losses', value: 8 },
            { name: 'pointsFor', value: 73 }, { name: 'pointsAgainst', value: 41 },
            { name: 'pointDifferential', value: 32 }, { name: 'points', value: 82 },
            { name: 'deductions', value: -5 }, { name: 'rank', value: 1 },
          ] },
      ],
    },
  }],
};

test('standings: rows sorted by rank, renumbered, deductions preserved', () => {
  const rows = adaptStandings(standings);
  expect(rows.map(r => r.name)).toEqual(['Celtic', 'Heart of Midlothian']);
  expect(rows[0].position).toBe(1);
  expect(rows[0].points).toBe(82);
  expect(rows[0].deduction).toBe(-5);
  expect(rows[1].goalDifference).toBe(33);
  expect(rows[1].crestUrl).toBe('hearts.png');
});

const teams = {
  sports: [{ leagues: [{ teams: [
    { team: { id: '263', displayName: 'Aberdeen', shortDisplayName: 'Aberdeen',
              color: 'C8142F', logos: [{ href: 'abz.png' }] } },
  ] }] }],
};

test('teams: id, colour and crest come through', () => {
  const [t] = adaptTeams(teams);
  expect(t).toEqual({ id: '263', name: 'Aberdeen', shortName: 'Aberdeen',
    crestUrl: 'abz.png', monogram: 'AB', colour: 'C8142F' });
});

const squad = {
  team: { id: '256', athletes: [
    { id: '227283', displayName: 'Ross Doohan',
      position: { abbreviation: 'G' }, jersey: '1', age: 28, citizenship: 'Scotland' },
    { id: '9', displayName: 'No Details' },
  ] },
};

test('squad: players map with null-safe optional fields', () => {
  const players = adaptSquad(squad);
  expect(players[0]).toEqual({ id: '227283', name: 'Ross Doohan', position: 'G',
    shirt: '1', age: 28, nationality: 'Scotland' });
  expect(players[1].position).toBeNull();
  expect(players[1].shirt).toBeNull();
});

const summary = {
  keyEvents: [
    { clock: { displayValue: "11'" }, type: { text: 'Goal' },
      athletesInvolved: [{ displayName: 'Daizen Maeda' }], team: { id: '256' } },
    { clock: { displayValue: "59'" }, type: { text: 'Substitution' } }, // no athletes — real case
  ],
  boxscore: { teams: [
    { team: { id: '256', displayName: 'Celtic' },
      statistics: [{ name: 'possessionPct', displayValue: '58' }] },
    { team: { id: '257', displayName: 'Rangers' },
      statistics: [{ name: 'possessionPct', displayValue: '42' }] },
  ] },
  rosters: [
    { homeAway: 'home', roster: [
      { athlete: { displayName: 'Kasper Schmeichel' }, jersey: '1', starter: true,
        position: { abbreviation: 'G' } },
    ] },
  ],
};

test('summary: events null-safe, team stats keyed by name, lineups mapped', () => {
  const d = adaptSummary(summary);
  expect(d.events[0]).toEqual({ minute: "11'", type: 'Goal', player: 'Daizen Maeda', teamId: '256' });
  expect(d.events[1].player).toBeNull();
  expect(d.teamStats[0].stats.possessionPct).toBe('58');
  expect(d.lineups[0].players[0]).toEqual({ name: 'Kasper Schmeichel', shirt: '1',
    starter: true, position: 'G' });
});

test('summary: missing boxscore yields null teamStats, not a crash', () => {
  expect(adaptSummary({}).teamStats).toBeNull();
  expect(adaptSummary({}).events).toEqual([]);
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/data/espn`
Expected: FAIL — cannot find module `./espn.js`.

- [ ] **Step 3: implement**

`src/data/espn.js`:

```js
// ESPN → domain adapters (spec §4.3). Nothing above this file may know
// ESPN's response shapes. All lookups are null-safe: these are
// undocumented feeds and absent fields are a normal Tuesday.
import { monogram } from '../domain/monogram.js';

const STATUS_BY_NAME = {
  STATUS_SCHEDULED: 'scheduled',
  STATUS_POSTPONED: 'postponed',
  STATUS_CANCELED: 'canceled',
  STATUS_FULL_TIME: 'ft',
  STATUS_FINAL: 'ft',
};

function fixtureStatus(type) {
  if (STATUS_BY_NAME[type?.name]) return STATUS_BY_NAME[type.name];
  if (type?.state === 'in') return 'live';
  if (type?.state === 'post') return 'ft';
  return 'scheduled';
}

function side(competitor = {}) {
  const t = competitor.team ?? {};
  const name = t.displayName ?? t.name ?? 'Unknown';
  return {
    teamId: t.id ?? null,
    name,
    shortName: t.shortDisplayName ?? t.abbreviation ?? name,
    crestUrl: t.logo ?? t.logos?.[0]?.href ?? null,
    monogram: monogram(name),
    colour: t.color ?? null,
    score: competitor.score != null && competitor.score !== '' ? Number(competitor.score) : null,
  };
}

export function adaptScoreboard(json, compId) {
  return (json?.events ?? []).map(ev => {
    const comp = ev.competitions?.[0] ?? {};
    const competitors = comp.competitors ?? [];
    return {
      id: ev.id,
      compId,
      kickoff: ev.date,
      status: fixtureStatus(ev.status?.type),
      minute: ev.status?.displayClock ?? null,
      round: ev.season?.slug ?? null,
      venue: comp.venue?.fullName ?? null,
      home: side(competitors.find(c => c.homeAway === 'home')),
      away: side(competitors.find(c => c.homeAway === 'away')),
    };
  });
}

export function adaptStandings(json) {
  const entries = json?.children?.[0]?.standings?.entries ?? json?.standings?.entries ?? [];
  const rows = entries.map(en => {
    const s = Object.fromEntries((en.stats ?? []).map(x => [x.name, x.value]));
    const t = en.team ?? {};
    const name = t.displayName ?? 'Unknown';
    return {
      teamId: t.id ?? null,
      name,
      crestUrl: t.logos?.[0]?.href ?? null,
      monogram: monogram(name),
      played: s.gamesPlayed ?? 0,
      won: s.wins ?? 0,
      drawn: s.ties ?? 0,
      lost: s.losses ?? 0,
      goalsFor: s.pointsFor ?? 0,
      goalsAgainst: s.pointsAgainst ?? 0,
      goalDifference: s.pointDifferential ?? 0,
      points: s.points ?? 0,
      deduction: s.deductions ?? 0,
      rank: s.rank ?? 99,
    };
  });
  rows.sort((a, b) => a.rank - b.rank);
  return rows.map(({ rank, ...r }, i) => ({ ...r, position: i + 1 }));
}

export function adaptTeams(json) {
  return (json?.sports?.[0]?.leagues?.[0]?.teams ?? []).map(({ team: t }) => ({
    id: t.id,
    name: t.displayName,
    shortName: t.shortDisplayName ?? t.abbreviation ?? t.displayName,
    crestUrl: t.logos?.[0]?.href ?? null,
    monogram: monogram(t.displayName ?? ''),
    colour: t.color ?? null,
  }));
}

export function adaptSquad(json) {
  return (json?.team?.athletes ?? []).map(a => ({
    id: a.id,
    name: a.displayName ?? a.fullName ?? 'Unknown',
    position: a.position?.abbreviation ?? a.position?.name ?? null,
    shirt: a.jersey ?? null,
    age: a.age ?? null,
    nationality: a.citizenship ?? null,
  }));
}

export function adaptSummary(json) {
  const events = (json?.keyEvents ?? []).map(k => ({
    minute: k.clock?.displayValue ?? '',
    type: k.type?.text ?? '',
    player: k.athletesInvolved?.[0]?.displayName ?? null,
    teamId: k.team?.id ?? null,
  }));
  const boxTeams = json?.boxscore?.teams ?? [];
  const teamStats = boxTeams.length === 2
    ? boxTeams.map(t => ({
        teamId: t.team?.id ?? null,
        name: t.team?.displayName ?? '',
        stats: Object.fromEntries((t.statistics ?? []).map(s => [s.name, s.displayValue])),
      }))
    : null;
  const lineups = (json?.rosters ?? []).map(r => ({
    homeAway: r.homeAway ?? null,
    players: (r.roster ?? []).map(p => ({
      name: p.athlete?.displayName ?? '',
      shirt: p.jersey ?? p.athlete?.jersey ?? null,
      starter: p.starter ?? false,
      position: p.position?.abbreviation ?? null,
    })),
  }));
  return { events, teamStats, lineups };
}
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/data/espn`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/espn.js src/data/espn.test.js
git commit -m "feat: ESPN adapters for scoreboard, standings, teams, squad, summary"
```

---

### Task 4: BBC adapter

**Files:**
- Create: `src/data/bbc.js`
- Test: `src/data/bbc.test.js`

**Interfaces:**
- Consumes: `monogram(name)` from Task 2.
- Produces: `adaptBbcFixtures(json, compId) → Fixture[]` — same `Fixture`/`Side` shapes as Task 3, always `crestUrl: null`, `round: null`, `venue: null`.

- [ ] **Step 1: failing tests**

`src/data/bbc.test.js`:

```js
import { adaptBbcFixtures } from './bbc.js';

const bbc = {
  eventGroups: [{
    displayLabel: 'Saturday 1st August',
    secondaryGroups: [{
      events: [
        {
          id: 's-1', startDateTime: '2026-08-01T14:00:00Z', status: 'PostEvent',
          periodLabel: { value: 'FT' }, statusComment: { accessible: 'Full time' },
          home: { id: 'h1', fullName: 'Alloa Athletic', shortName: 'Alloa', score: '0' },
          away: { id: 'a1', fullName: 'East Fife', shortName: 'East Fife', score: '0' },
        },
        {
          id: 's-2', startDateTime: '2026-08-25T18:45:00Z', status: 'PreEvent',
          periodLabel: null, statusComment: null,
          home: { id: 'h2', fullName: 'Cove Rangers', shortName: 'Cove' },
          away: { id: 'a2', fullName: 'Kelty Hearts', shortName: 'Kelty' },
        },
        {
          id: 's-3', startDateTime: '2026-08-25T18:45:00Z', status: 'MidEvent',
          periodLabel: { value: "63'" }, statusComment: { accessible: 'In play' },
          home: { id: 'h3', fullName: 'Queen of the South', score: '1' },
          away: { id: 'a3', fullName: 'Montrose', score: '1' },
        },
        {
          id: 's-4', startDateTime: '2026-09-01T18:45:00Z', status: 'PreEvent',
          periodLabel: null, statusComment: { accessible: 'Postponed' },
          home: { id: 'h4', fullName: 'Dumbarton' },
          away: { id: 'a4', fullName: 'Peterhead' },
        },
      ],
    }],
  }],
};

test('flattens the nested groups and maps the domain shape', () => {
  const fx = adaptBbcFixtures(bbc, 'scottish-league-one');
  expect(fx).toHaveLength(4);
  expect(fx[0].compId).toBe('scottish-league-one');
  expect(fx[0].status).toBe('ft');
  expect(fx[0].home.name).toBe('Alloa Athletic');
  expect(fx[0].home.score).toBe(0);
  expect(fx[0].home.crestUrl).toBeNull();
  expect(fx[0].home.monogram).toBe('AA');
});

test('missing score is null, not zero — a 0-0 and an unplayed game differ', () => {
  expect(adaptBbcFixtures(bbc, 'x')[1].home.score).toBeNull();
  expect(adaptBbcFixtures(bbc, 'x')[1].status).toBe('scheduled');
});

test('MidEvent maps to live and carries the period label as minute', () => {
  const live = adaptBbcFixtures(bbc, 'x')[2];
  expect(live.status).toBe('live');
  expect(live.minute).toBe("63'");
});

test('statusComment Postponed wins over the raw status', () => {
  expect(adaptBbcFixtures(bbc, 'x')[3].status).toBe('postponed');
});

test('empty and malformed payloads yield an empty list', () => {
  expect(adaptBbcFixtures({}, 'x')).toEqual([]);
  expect(adaptBbcFixtures(null, 'x')).toEqual([]);
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/data/bbc`
Expected: FAIL — cannot find module `./bbc.js`.

- [ ] **Step 3: implement**

`src/data/bbc.js`:

```js
// BBC → domain adapter for Scottish League One and Two (spec §3.3).
// The BBC feed never provides crests — every side falls back to its
// monogram — and provides no round or venue data.
import { monogram } from '../domain/monogram.js';

const STATUS = { PreEvent: 'scheduled', MidEvent: 'live', PostEvent: 'ft' };

function side(s = {}) {
  const name = s.fullName ?? '';
  return {
    teamId: s.id ?? null,
    name,
    shortName: s.shortName ?? name,
    crestUrl: null,
    monogram: monogram(name),
    colour: null,
    score: s.score != null && s.score !== '' ? Number(s.score) : null,
  };
}

export function adaptBbcFixtures(json, compId) {
  const events = (json?.eventGroups ?? []).flatMap(g =>
    (g.secondaryGroups ?? []).flatMap(sg => sg.events ?? []));
  return events.map(ev => ({
    id: ev.id,
    compId,
    kickoff: ev.startDateTime,
    status: /postpon/i.test(ev.statusComment?.accessible ?? '')
      ? 'postponed'
      : STATUS[ev.status] ?? 'scheduled',
    minute: ev.periodLabel?.value ?? null,
    round: null,
    venue: null,
    home: side(ev.home),
    away: side(ev.away),
  }));
}
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/data/bbc`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/bbc.js src/data/bbc.test.js
git commit -m "feat: BBC adapter for Scottish League One and Two"
```

---

### Task 5: Computed tables and form guides

**Files:**
- Create: `src/domain/table.js`, `src/domain/form.js`
- Test: `src/domain/table.test.js`, `src/domain/form.test.js`

**Interfaces:**
- Consumes: `Fixture` shape from Task 3.
- Produces: `computeTable(fixtures) → TableRow[]` (same `TableRow` as Task 3, `deduction` always 0); `formGuide(fixtures, teamId, n = 5) → ('W'|'D'|'L')[]` oldest→newest.

- [ ] **Step 1: failing tests**

`src/domain/table.test.js`:

```js
import { computeTable } from './table.js';

const side = (teamId, name, score) => ({
  teamId, name, shortName: name, crestUrl: null, monogram: 'XX', colour: null, score,
});
const ft = (h, a) => ({ status: 'ft', kickoff: '2026-08-01T14:00Z', home: h, away: a });

const fixtures = [
  ft(side('1', 'Ayr', 2), side('2', 'Arbroath', 0)),
  ft(side('2', 'Arbroath', 1), side('3', 'Cove', 1)),
  ft(side('3', 'Cove', 3), side('1', 'Ayr', 0)),
  // unplayed and live games must not count
  { status: 'scheduled', kickoff: '2027-01-01T15:00Z',
    home: side('1', 'Ayr', null), away: side('3', 'Cove', null) },
  { status: 'live', kickoff: '2026-08-08T15:00Z',
    home: side('2', 'Arbroath', 1), away: side('1', 'Ayr', 0) },
];

test('points, W/D/L and goals accumulate from full-time results only', () => {
  const t = computeTable(fixtures);
  const cove = t.find(r => r.name === 'Cove');
  expect(cove.played).toBe(2);
  expect(cove.won).toBe(1);
  expect(cove.drawn).toBe(1);
  expect(cove.points).toBe(4);
  expect(cove.goalsFor).toBe(4);
  expect(cove.goalsAgainst).toBe(1);
});

test('sort: points, then goal difference, then goals for; positions renumbered', () => {
  const t = computeTable(fixtures);
  // Cove 4pts. Ayr 3pts GD -1, Arbroath 1pt.
  expect(t.map(r => r.name)).toEqual(['Cove', 'Ayr', 'Arbroath']);
  expect(t.map(r => r.position)).toEqual([1, 2, 3]);
  expect(t[1].goalDifference).toBe(-1);
});

test('empty input gives an empty table', () => {
  expect(computeTable([])).toEqual([]);
});
```

`src/domain/form.test.js`:

```js
import { formGuide } from './form.js';

const side = (teamId, score) => ({ teamId, name: teamId, score });
const f = (kickoff, h, hs, a, as, status = 'ft') =>
  ({ status, kickoff, home: side(h, hs), away: side(a, as) });

const fixtures = [
  f('2026-08-01T14:00Z', 'CEL', 2, 'RAN', 0),
  f('2026-08-08T14:00Z', 'ABE', 1, 'CEL', 1),
  f('2026-08-15T14:00Z', 'CEL', 0, 'HEA', 3),
  f('2026-08-22T14:00Z', 'CEL', 1, 'DUN', 0),
  f('2026-08-29T14:00Z', 'STM', 0, 'CEL', 2),
  f('2026-09-05T14:00Z', 'CEL', 4, 'KIL', 0),
  f('2026-09-12T14:00Z', 'CEL', 0, 'RAN', 0, 'scheduled'), // future — ignored
];

test('last five completed results, oldest first, from home and away', () => {
  expect(formGuide(fixtures, 'CEL')).toEqual(['D', 'L', 'W', 'W', 'W']);
});

test('n limits the window', () => {
  expect(formGuide(fixtures, 'CEL', 2)).toEqual(['W', 'W']);
});

test('team with no completed games has empty form', () => {
  expect(formGuide(fixtures, 'NOPE')).toEqual([]);
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/domain/table src/domain/form`
Expected: FAIL — modules not found.

- [ ] **Step 3: implement**

`src/domain/table.js`:

```js
// League table computed from results — the tables for the two
// BBC-sourced leagues, which have no standings endpoint (spec §3.3).
// 3/1/0 points; sort points → goal difference → goals for → name.
export function computeTable(fixtures) {
  const rows = new Map();
  const rowFor = side => {
    if (!rows.has(side.teamId)) {
      rows.set(side.teamId, {
        teamId: side.teamId, name: side.name, crestUrl: side.crestUrl ?? null,
        monogram: side.monogram, played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, deduction: 0,
      });
    }
    return rows.get(side.teamId);
  };

  for (const f of fixtures) {
    if (f.status !== 'ft' || f.home.score == null || f.away.score == null) continue;
    const h = rowFor(f.home);
    const a = rowFor(f.away);
    h.played += 1; a.played += 1;
    h.goalsFor += f.home.score; h.goalsAgainst += f.away.score;
    a.goalsFor += f.away.score; a.goalsAgainst += f.home.score;
    if (f.home.score > f.away.score) { h.won += 1; h.points += 3; a.lost += 1; }
    else if (f.home.score < f.away.score) { a.won += 1; a.points += 3; h.lost += 1; }
    else { h.drawn += 1; a.drawn += 1; h.points += 1; a.points += 1; }
  }

  const list = [...rows.values()];
  for (const r of list) r.goalDifference = r.goalsFor - r.goalsAgainst;
  list.sort((x, y) =>
    y.points - x.points || y.goalDifference - x.goalDifference ||
    y.goalsFor - x.goalsFor || x.name.localeCompare(y.name));
  return list.map((r, i) => ({ ...r, position: i + 1 }));
}
```

`src/domain/form.js`:

```js
// Last-n form for a team across a fixture list, oldest → newest.
export function formGuide(fixtures, teamId, n = 5) {
  return fixtures
    .filter(f => f.status === 'ft'
      && (f.home.teamId === teamId || f.away.teamId === teamId)
      && f.home.score != null && f.away.score != null)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
    .slice(-n)
    .map(f => {
      const mine = f.home.teamId === teamId ? f.home.score : f.away.score;
      const theirs = f.home.teamId === teamId ? f.away.score : f.home.score;
      return mine > theirs ? 'W' : mine === theirs ? 'D' : 'L';
    });
}
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/domain`
Expected: all domain tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/table.js src/domain/table.test.js src/domain/form.js src/domain/form.test.js
git commit -m "feat: computed league tables and form guides"
```

---

### Task 6: ESPN proxy function

**Files:**
- Create: `api/espn.js`
- Test: `src/test/api/espn.test.js`

**Interfaces:**
- Produces: default-export Node handler `(req, res)`. URL contract (both forms must work — dev shim passes the path form, Vercel rewrite passes `?_p=`):
  - `/api/espn/apis/site/v2/sports/soccer/{league}/scoreboard?dates=...&limit=500`
  - `/api/espn/apis/site/v2/sports/soccer/{league}/teams[/{id}?enable=roster]`
  - `/api/espn/apis/site/v2/sports/soccer/{league}/summary?event={id}`
  - `/api/espn/apis/v2/sports/soccer/{league}/standings?season=2026`
- Response headers: `Cache-Control` per spec §4.2 on success; `x-lkg-at: <ISO>` + `no-store` when serving last-known-good.

- [ ] **Step 1: failing tests**

`src/test/api/espn.test.js`:

```js
import { beforeEach, expect, test, vi } from 'vitest';
import handler from '../../../api/espn.js';

function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b; },
  };
}
const call = async url => {
  const res = fakeRes();
  await handler({ url }, res);
  return res;
};

beforeEach(() => { vi.unstubAllGlobals(); });

test('rejects non-allowlisted paths without touching the network', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  const res = await call('/api/espn/apis/site/v2/sports/soccer/usa.1/scoreboard');
  expect(res.statusCode).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('rejects arbitrary path traversal', async () => {
  vi.stubGlobal('fetch', vi.fn());
  const res = await call('/api/espn/apis/site/v2/whatever');
  expect(res.statusCode).toBe(400);
});

test('passes an allowlisted request through with season-fixtures cache headers', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ events: [] }), { status: 200, headers: { 'content-type': 'application/json' } })));
  const res = await call(
    '/api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=20260701-20270630&limit=500');
  expect(res.statusCode).toBe(200);
  expect(res.headers['cache-control']).toBe('public, s-maxage=3600, stale-while-revalidate=604800');
  expect(fetch).toHaveBeenCalledWith(
    'https://site.api.espn.com/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=20260701-20270630&limit=500',
    expect.objectContaining({ headers: { accept: 'application/json' } }),
  );
});

test('handles the Vercel rewrite form (?_p=)', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"events":[]}', { status: 200 })));
  const res = await call(
    '/api/espn?_p=/apis/v2/sports/soccer/eng.1/standings&season=2026');
  expect(res.statusCode).toBe(200);
  expect(res.headers['cache-control']).toBe('public, s-maxage=600, stale-while-revalidate=86400');
  expect(fetch).toHaveBeenCalledWith(
    'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=2026',
    expect.anything(),
  );
});

test('a short dates window gets the tight live TTL', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"events":[]}', { status: 200 })));
  const res = await call(
    '/api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=20260812-20260813');
  expect(res.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
});

test('upstream failure after a success serves last-known-good with x-lkg-at', async () => {
  const url = '/api/espn/apis/site/v2/sports/soccer/sco.2/teams';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"sports":[1]}', { status: 200 })));
  await call(url);
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
  const res = await call(url);
  expect(res.statusCode).toBe(200);
  expect(res.body).toBe('{"sports":[1]}');
  expect(res.headers['x-lkg-at']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(res.headers['cache-control']).toBe('no-store');
});

test('an HTTP-200 error body is treated as failure, not cached as good', async () => {
  const url = '/api/espn/apis/site/v2/sports/soccer/sco.cis/teams';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}', { status: 200 })));
  await call(url);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ errors: ['nope'] }), { status: 200 })));
  const res = await call(url);
  expect(res.body).toBe('{"ok":true}'); // last-known-good, not the error body
  expect(res.headers['x-lkg-at']).toBeTruthy();
});

test('failure with no stored fallback passes the upstream status through', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 502 })));
  const res = await call('/api/espn/apis/site/v2/sports/soccer/eng.fa/teams');
  expect(res.statusCode).toBe(502);
  expect(res.headers['cache-control']).toBe('no-store');
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/test/api/espn`
Expected: FAIL — cannot find module `../../../api/espn.js`.

- [ ] **Step 3: implement**

`api/espn.js`:

```js
// api/espn.js — Vercel serverless function. Allowlisted pass-through
// proxy to ESPN's public JSON API, with edge caching (spec §4.2) and a
// last-known-good fallback that survives warm invocations.
//
// Browser : GET /api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=...
// Rewrite : (vercel.json)  /api/espn/(.*) -> /api/espn?_p=/$1
// Upstream: GET https://site.api.espn.com/apis/...
//
// IMPORTANT (spec §3.5): never attach a browser User-Agent — ESPN
// returns 403 to spoofed browser UAs and serves the default UA fine.

const UPSTREAM = 'https://site.api.espn.com';

const LEAGUE =
  '(sco\\.1|sco\\.2|sco\\.tennents|sco\\.cis|sco\\.challenge|eng\\.1|eng\\.fa|eng\\.league_cup|uefa\\.champions|uefa\\.europa|uefa\\.europa\\.conf)';
const ALLOWED = [
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/scoreboard$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/teams$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/teams/\\d+$`),
  new RegExp(`^/apis/site/v2/sports/soccer/${LEAGUE}/summary$`),
  new RegExp(`^/apis/v2/sports/soccer/${LEAGUE}/standings$`),
];

const lastKnownGood = new Map(); // key: rest+query → { body, at }

export default async function handler(req, res) {
  const { rest, query } = extractRest(req.url);
  if (!ALLOWED.some(rx => rx.test(rest))) {
    return send(res, 400, JSON.stringify({ error: `Path not allowed: ${rest}` }));
  }
  const key = rest + query;
  try {
    const upstream = await fetch(UPSTREAM + rest + query, {
      headers: { accept: 'application/json' },
    });
    const text = await upstream.text();
    if (upstream.ok && !looksLikeErrorBody(text)) {
      lastKnownGood.set(key, { body: text, at: new Date().toISOString() });
      const ttl = ttlFor(rest, query);
      res.setHeader('Cache-Control',
        `public, s-maxage=${ttl.fresh}, stale-while-revalidate=${ttl.swr}`);
      return send(res, 200, text);
    }
    return serveFallback(res, key, upstream.status, text);
  } catch (err) {
    return serveFallback(res, key, 502, JSON.stringify({ error: String(err?.message ?? err) }));
  }
}

function serveFallback(res, key, status, failureBody) {
  res.setHeader('Cache-Control', 'no-store');
  const lkg = lastKnownGood.get(key);
  if (lkg) {
    res.setHeader('x-lkg-at', lkg.at);
    return send(res, 200, lkg.body);
  }
  return send(res, status >= 400 ? status : 502, failureBody);
}

// ESPN sometimes answers HTTP 200 with an error body (spec §3.5) —
// never store or cache one of those as "good".
function looksLikeErrorBody(text) {
  try {
    const j = JSON.parse(text);
    return j == null || j.error != null || j.errors != null;
  } catch {
    return true;
  }
}

// Edge TTLs from spec §4.2. A dates window over 3 days is a season
// fetch; a narrow window carries live scores and stays tight.
function ttlFor(rest, query) {
  if (rest.includes('/standings')) return { fresh: 600, swr: 86400 };
  if (/\/teams(\/|$)/.test(rest)) return { fresh: 86400, swr: 604800 };
  if (rest.includes('/summary')) return { fresh: 30, swr: 120 };
  const m = /dates=(\d{8})-(\d{8})/.exec(query);
  if (m && spanDays(m[1], m[2]) > 3) return { fresh: 3600, swr: 604800 };
  return { fresh: 30, swr: 300 };
}

function spanDays(a, b) {
  const d = s => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
  return (d(b) - d(a)) / 86400000;
}

// Handles both the local-dev path form and the rewritten ?_p= form.
function extractRest(reqUrl) {
  const [pathOnly, search = ''] = reqUrl.split('?');
  const params = new URLSearchParams(search);
  const rewritten = params.get('_p');
  if (rewritten) {
    params.delete('_p');
    const q = params.toString();
    return { rest: rewritten.startsWith('/') ? rewritten : `/${rewritten}`, query: q ? `?${q}` : '' };
  }
  const PREFIX = '/api/espn';
  const rest = pathOnly.startsWith(PREFIX) ? pathOnly.slice(PREFIX.length) : pathOnly;
  return { rest: rest || '/', query: search ? `?${search}` : '' };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(body);
}
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/test/api/espn`
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/espn.js src/test/api/espn.test.js
git commit -m "feat: ESPN proxy with allowlist, edge cache TTLs and last-known-good"
```

---

### Task 7: BBC proxy, vercel.json, live verification

**Files:**
- Create: `api/bbc.js`, `vercel.json`
- Test: `src/test/api/bbc.test.js`

**Interfaces:**
- Produces: default-export handler for `GET /api/bbc?tournament={slug}&start=YYYY-MM-DD&end=YYYY-MM-DD` where slug ∈ `scottish-league-one|scottish-league-two`. Same header contract as Task 6. Also the production `vercel.json`.

- [ ] **Step 1: failing tests**

`src/test/api/bbc.test.js`:

```js
import { beforeEach, expect, test, vi } from 'vitest';
import handler from '../../../api/bbc.js';

function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b; },
  };
}
const call = async url => {
  const res = fakeRes();
  await handler({ url }, res);
  return res;
};

beforeEach(() => { vi.unstubAllGlobals(); });

test('rejects unknown tournaments and bad dates without fetching', async () => {
  const spy = vi.fn();
  vi.stubGlobal('fetch', spy);
  expect((await call('/api/bbc?tournament=premier-league&start=2026-08-01&end=2026-08-31')).statusCode).toBe(400);
  expect((await call('/api/bbc?tournament=scottish-league-one&start=nonsense&end=2026-08-31')).statusCode).toBe(400);
  expect((await call('/api/bbc?tournament=scottish-league-one&start=2026-08-01')).statusCode).toBe(400);
  expect(spy).not.toHaveBeenCalled();
});

test('builds the upstream URL with the urn and passes the body through', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"eventGroups":[]}', { status: 200 })));
  const res = await call('/api/bbc?tournament=scottish-league-one&start=2026-07-01&end=2027-06-30');
  expect(res.statusCode).toBe(200);
  expect(res.body).toBe('{"eventGroups":[]}');
  const url = fetch.mock.calls[0][0];
  expect(url).toContain('selectedStartDate=2026-07-01');
  expect(url).toContain('selectedEndDate=2027-06-30');
  expect(url).toContain(encodeURIComponent('urn:bbc:sportsdata:football:tournament:scottish-league-one'));
  // season-length window → season TTL
  expect(res.headers['cache-control']).toBe('public, s-maxage=3600, stale-while-revalidate=604800');
});

test('a one-day window gets the tight live TTL', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"eventGroups":[]}', { status: 200 })));
  const res = await call('/api/bbc?tournament=scottish-league-two&start=2026-08-12&end=2026-08-13');
  expect(res.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
});

test('failure serves last-known-good with x-lkg-at', async () => {
  const url = '/api/bbc?tournament=scottish-league-two&start=2026-07-01&end=2027-06-30';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"eventGroups":[1]}', { status: 200 })));
  await call(url);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));
  const res = await call(url);
  expect(res.statusCode).toBe(200);
  expect(res.body).toBe('{"eventGroups":[1]}');
  expect(res.headers['x-lkg-at']).toBeTruthy();
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/test/api/bbc`
Expected: FAIL — module not found.

- [ ] **Step 3: implement**

`api/bbc.js`:

```js
// api/bbc.js — proxy for the BBC scores/fixtures container feeding
// Scottish League One and Two (spec §3.3). Query interface instead of
// path pass-through: the upstream has exactly one endpoint and only the
// two tournaments are permitted.

const UPSTREAM = 'https://web-cdn.api.bbci.co.uk/wc-data/container/sport-data-scores-fixtures';
const TOURNAMENTS = new Set(['scottish-league-one', 'scottish-league-two']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const lastKnownGood = new Map();

export default async function handler(req, res) {
  const params = new URLSearchParams(req.url.split('?')[1] ?? '');
  const tournament = params.get('tournament');
  const start = params.get('start');
  const end = params.get('end');
  if (!TOURNAMENTS.has(tournament) || !DATE.test(start ?? '') || !DATE.test(end ?? '')) {
    return send(res, 400, JSON.stringify({ error: 'tournament, start and end are required' }));
  }

  const upstreamUrl = `${UPSTREAM}?selectedStartDate=${start}&selectedEndDate=${end}` +
    `&todayDate=${new Date().toISOString().slice(0, 10)}` +
    `&urn=${encodeURIComponent(`urn:bbc:sportsdata:football:tournament:${tournament}`)}`;
  const key = `${tournament}:${start}:${end}`;

  try {
    const upstream = await fetch(upstreamUrl, { headers: { accept: 'application/json' } });
    const text = await upstream.text();
    if (upstream.ok && looksLikeJson(text)) {
      lastKnownGood.set(key, { body: text, at: new Date().toISOString() });
      const days = (new Date(end) - new Date(start)) / 86400000;
      const ttl = days > 3 ? { fresh: 3600, swr: 604800 } : { fresh: 30, swr: 300 };
      res.setHeader('Cache-Control',
        `public, s-maxage=${ttl.fresh}, stale-while-revalidate=${ttl.swr}`);
      return send(res, 200, text);
    }
    return serveFallback(res, key, upstream.status, text);
  } catch (err) {
    return serveFallback(res, key, 502, JSON.stringify({ error: String(err?.message ?? err) }));
  }
}

function serveFallback(res, key, status, failureBody) {
  res.setHeader('Cache-Control', 'no-store');
  const lkg = lastKnownGood.get(key);
  if (lkg) {
    res.setHeader('x-lkg-at', lkg.at);
    return send(res, 200, lkg.body);
  }
  return send(res, status >= 400 ? status : 502, failureBody);
}

function looksLikeJson(text) {
  try { return JSON.parse(text) != null; } catch { return false; }
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(body);
}
```

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/api/espn/(.*)", "destination": "/api/espn?_p=/$1" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/test/api`
Expected: both proxy test files pass.

- [ ] **Step 5: live smoke check through the dev shim**

Run: `npm run dev` in one terminal, then:

```bash
curl -s "http://localhost:5173/api/espn/apis/site/v2/sports/soccer/sco.1/teams" | head -c 200
curl -s "http://localhost:5173/api/bbc?tournament=scottish-league-one&start=2026-08-01&end=2026-08-31" | head -c 200
```

Expected: real JSON from both (ESPN team list; BBC eventGroups). This is the one deliberately-networked check in the plan — it proves the shim, the allowlist and both upstreams in one go. Stop the dev server after.

- [ ] **Step 6: Commit**

```bash
git add api/bbc.js src/test/api/bbc.test.js vercel.json
git commit -m "feat: BBC proxy and Vercel rewrites"
```

---

### Task 8: Client fetch layer and query hooks

**Files:**
- Create: `src/data/client.js`, `src/data/queries.js`
- Test: `src/data/client.test.js`, `src/data/pollMs.test.js`

**Interfaces:**
- Consumes: adapters (Tasks 3–4), `computeTable` (Task 5), `SEASON`/`COMPETITIONS` (Task 2).
- Produces:
  - `espnUrl(rest, params?) → string`, `bbcUrl(tournament, start, end) → string`, `getJson(url) → Promise<{data, asOf: string|null}>` (`asOf` from the `x-lkg-at` header).
  - `pollMs(fixtures, now?) → 30000|60000|false` — the live-polling gate, exported for tests.
  - Hooks: `useSeasonFixtures(comp)` → `{fixtures, asOf}`; `useAllSeasonFixtures(comps)` (useQueries array); `useTodayWindows(comps)` → per-comp `{fixtures, asOf}` covering yesterday+today with live polling; `useTable(comp)` → `{rows, asOf, fixtures}` (ESPN standings or computed); `useTeams(comp)`; `useAllTeams(comps)` (useQueries array, one entry per comp); `useSquad(comp, teamId)`; `useMatchDetail(comp, eventId, isLive)`.

- [ ] **Step 1: failing tests**

`src/data/client.test.js`:

```js
import { espnUrl, bbcUrl } from './client.js';

test('espnUrl composes path and query', () => {
  expect(espnUrl('/apis/site/v2/sports/soccer/sco.1/scoreboard', { dates: '20260701-20270630', limit: 500 }))
    .toBe('/api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=20260701-20270630&limit=500');
  expect(espnUrl('/apis/v2/sports/soccer/eng.1/standings', { season: 2026 }))
    .toBe('/api/espn/apis/v2/sports/soccer/eng.1/standings?season=2026');
});

test('bbcUrl composes the query form', () => {
  expect(bbcUrl('scottish-league-one', '2026-07-01', '2027-06-30'))
    .toBe('/api/bbc?tournament=scottish-league-one&start=2026-07-01&end=2027-06-30');
});
```

`src/data/pollMs.test.js`:

```js
import { pollMs } from './queries.js';

const at = iso => new Date(iso).getTime();
const f = (status, kickoff) => ({ status, kickoff });

test('any live fixture polls at 30s', () => {
  expect(pollMs([f('ft', '2026-08-13T12:00Z'), f('live', '2026-08-13T14:00Z')],
    at('2026-08-13T15:00Z'))).toBe(30000);
});

test('a kickoff within two hours polls at 60s', () => {
  expect(pollMs([f('scheduled', '2026-08-13T15:00Z')], at('2026-08-13T14:00Z'))).toBe(60000);
});

test('a quiet day does not poll at all', () => {
  expect(pollMs([f('scheduled', '2026-08-13T15:00Z')], at('2026-08-13T09:00Z'))).toBe(false);
  expect(pollMs([f('ft', '2026-08-12T15:00Z')], at('2026-08-13T09:00Z'))).toBe(false);
  expect(pollMs([], at('2026-08-13T09:00Z'))).toBe(false);
  expect(pollMs(undefined, at('2026-08-13T09:00Z'))).toBe(false);
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/data/client src/data/pollMs`
Expected: FAIL — modules not found.

- [ ] **Step 3: implement**

`src/data/client.js`:

```js
// Browser-side fetch helpers. Every URL points at our own proxy — the
// browser never talks to ESPN or the BBC directly (spec §4.2).

export function espnUrl(rest, params = {}) {
  const q = new URLSearchParams(params).toString();
  return `/api/espn${rest}${q ? `?${q}` : ''}`;
}

export function bbcUrl(tournament, start, end) {
  return `/api/bbc?tournament=${tournament}&start=${start}&end=${end}`;
}

export async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return { data: await r.json(), asOf: r.headers.get('x-lkg-at') };
}
```

`src/data/queries.js`:

```js
// TanStack Query hooks — the only place queryKeys and staleTimes live.
// Client staleTimes mirror the proxy's edge TTLs (spec §4.2) so the two
// cache layers agree about freshness.
import { useQueries, useQuery } from '@tanstack/react-query';
import { SEASON } from '../domain/competitions.js';
import { computeTable } from '../domain/table.js';
import { adaptScoreboard, adaptStandings, adaptSquad, adaptSummary, adaptTeams } from './espn.js';
import { adaptBbcFixtures } from './bbc.js';
import { bbcUrl, espnUrl, getJson } from './client.js';

const SOCCER = '/apis/site/v2/sports/soccer';
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// Poll only when there is something to poll for: 30s while any match is
// live, 60s when one kicks off within two hours, otherwise silence.
export function pollMs(fixtures, now = Date.now()) {
  if (!fixtures?.length) return false;
  if (fixtures.some(f => f.status === 'live')) return 30000;
  const soonMs = 2 * HOUR;
  const soon = fixtures.some(f => f.status === 'scheduled'
    && Math.abs(new Date(f.kickoff).getTime() - now) < soonMs);
  return soon ? 60000 : false;
}

const visiblePoll = q =>
  typeof document !== 'undefined' && document.visibilityState === 'visible'
    ? pollMs(q.state.data?.fixtures)
    : false;

export function seasonFixturesQuery(comp) {
  return {
    queryKey: ['season', comp.id],
    staleTime: HOUR,
    queryFn: async () => {
      if (comp.source === 'bbc') {
        const { data, asOf } = await getJson(bbcUrl(comp.id, SEASON.bbcStart, SEASON.bbcEnd));
        return { fixtures: adaptBbcFixtures(data, comp.id), asOf };
      }
      const { data, asOf } = await getJson(
        espnUrl(`${SOCCER}/${comp.id}/scoreboard`, { dates: SEASON.espnRange, limit: 500 }));
      return { fixtures: adaptScoreboard(data, comp.id), asOf };
    },
  };
}

export const useSeasonFixtures = comp => useQuery(seasonFixturesQuery(comp));
export const useAllSeasonFixtures = comps =>
  useQueries({ queries: comps.map(seasonFixturesQuery) });

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Yesterday + today in one window per competition — one request feeds
// the Live, Later Today and Yesterday sections at once.
export function todayWindowQuery(comp, now = new Date()) {
  const yesterday = new Date(now.getTime() - 24 * HOUR);
  return {
    queryKey: ['window', comp.id, ymd(yesterday), ymd(now)],
    staleTime: 30 * 1000,
    refetchInterval: visiblePoll,
    queryFn: async () => {
      if (comp.source === 'bbc') {
        const { data, asOf } = await getJson(bbcUrl(comp.id, isoDay(yesterday), isoDay(now)));
        return { fixtures: adaptBbcFixtures(data, comp.id), asOf };
      }
      const { data, asOf } = await getJson(
        espnUrl(`${SOCCER}/${comp.id}/scoreboard`, { dates: `${ymd(yesterday)}-${ymd(now)}` }));
      return { fixtures: adaptScoreboard(data, comp.id), asOf };
    },
  };
}

export const useTodayWindows = comps =>
  useQueries({ queries: comps.map(c => todayWindowQuery(c)) });

export function useTable(comp) {
  const season = useSeasonFixtures(comp);
  const espn = useQuery({
    queryKey: ['table', comp.id],
    enabled: comp.source === 'espn' && !!comp.hasTable,
    staleTime: 10 * MIN,
    queryFn: async () => {
      const { data, asOf } = await getJson(
        espnUrl(`/apis/v2/sports/soccer/${comp.id}/standings`, { season: SEASON.espnYear }));
      return { rows: adaptStandings(data), asOf };
    },
  });
  if (comp.hasTable === 'computed') {
    const fixtures = season.data?.fixtures;
    return {
      isLoading: season.isLoading,
      isError: season.isError,
      data: fixtures
        ? { rows: computeTable(fixtures), asOf: season.data.asOf, fixtures }
        : undefined,
    };
  }
  return {
    isLoading: espn.isLoading || season.isLoading,
    isError: espn.isError,
    data: espn.data
      ? { ...espn.data, fixtures: season.data?.fixtures ?? [] }
      : undefined,
  };
}

export function teamsQuery(comp) {
  return {
    queryKey: ['teams', comp.id],
    enabled: comp.source === 'espn',
    staleTime: 24 * HOUR,
    queryFn: async () => {
      const { data, asOf } = await getJson(espnUrl(`${SOCCER}/${comp.id}/teams`));
      return { teams: adaptTeams(data), asOf };
    },
  };
}

export const useTeams = comp => useQuery(teamsQuery(comp));
export const useAllTeams = comps => useQueries({ queries: comps.map(teamsQuery) });

export function useSquad(comp, teamId) {
  return useQuery({
    queryKey: ['squad', comp.id, teamId],
    enabled: !!comp?.hasSquads && !!teamId,
    staleTime: 24 * HOUR,
    queryFn: async () => {
      const { data, asOf } = await getJson(
        espnUrl(`${SOCCER}/${comp.id}/teams/${teamId}`, { enable: 'roster' }));
      return { players: adaptSquad(data), asOf };
    },
  });
}

export function useMatchDetail(comp, eventId, isLive) {
  return useQuery({
    queryKey: ['summary', comp.id, eventId],
    enabled: !!comp?.hasMatchDetail && !!eventId,
    staleTime: 30 * 1000,
    refetchInterval: isLive && typeof document !== 'undefined'
      && document.visibilityState === 'visible' ? 30000 : false,
    queryFn: async () => {
      const { data, asOf } = await getJson(
        espnUrl(`${SOCCER}/${comp.id}/summary`, { event: eventId }));
      return { detail: adaptSummary(data), asOf };
    },
  });
}
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/data`
Expected: adapter tests plus the two new files all pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/client.js src/data/client.test.js src/data/queries.js src/data/pollMs.test.js
git commit -m "feat: client fetch layer, query hooks and live-polling gate"
```

---

### Task 9: Preferences store

**Files:**
- Create: `src/store/prefs.js`
- Test: `src/store/prefs.test.js`

**Interfaces:**
- Produces: `usePrefs` (Zustand hook), `CELTIC` constant. State: `{ followed: {id: FollowedClub}, hiddenComps: string[] }`; actions `follow(club)`, `unfollow(id)` (no-op for Celtic), `toggleComp(id)`. `FollowedClub`: `{ id, name, crestUrl, monogram, colour }`. Persisted to `localStorage` under `mdf-prefs`.

- [ ] **Step 1: failing tests**

`src/store/prefs.test.js`:

```js
import { beforeEach, expect, test } from 'vitest';
import { usePrefs, CELTIC } from './prefs.js';

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({ followed: { [CELTIC.id]: CELTIC }, hiddenComps: [] });
});

test('Celtic is followed out of the box', () => {
  expect(usePrefs.getState().followed['256'].name).toBe('Celtic');
});

test('follow adds a club and persists it', () => {
  usePrefs.getState().follow({ id: '254', name: 'Falkirk', crestUrl: 'f.png',
    monogram: 'FA', colour: '000099' });
  expect(usePrefs.getState().followed['254'].name).toBe('Falkirk');
  expect(localStorage.getItem('mdf-prefs')).toContain('Falkirk');
});

test('unfollow removes a club', () => {
  usePrefs.getState().follow({ id: '254', name: 'Falkirk', crestUrl: null,
    monogram: 'FA', colour: null });
  usePrefs.getState().unfollow('254');
  expect(usePrefs.getState().followed['254']).toBeUndefined();
});

test('Celtic cannot be unfollowed', () => {
  usePrefs.getState().unfollow('256');
  expect(usePrefs.getState().followed['256']).toBeDefined();
});

test('toggleComp hides and reveals a competition', () => {
  usePrefs.getState().toggleComp('eng.fa');
  expect(usePrefs.getState().hiddenComps).toEqual(['eng.fa']);
  usePrefs.getState().toggleComp('eng.fa');
  expect(usePrefs.getState().hiddenComps).toEqual([]);
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/store`
Expected: FAIL — module not found.

- [ ] **Step 3: implement**

`src/store/prefs.js`:

```js
// Followed clubs and hidden competitions — the app's only persistent
// state (spec §4.5). Celtic is fixed (Global Constraints) and seeded
// into the initial state; unfollow() refuses to remove it.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const CELTIC = {
  id: '256',
  name: 'Celtic',
  crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/256.png',
  monogram: 'CE',
  colour: '009921',
};

export const usePrefs = create(persist(
  (set, get) => ({
    followed: { [CELTIC.id]: CELTIC },
    hiddenComps: [],
    follow: club => set(s => ({ followed: { ...s.followed, [club.id]: club } })),
    unfollow: id => {
      if (id === CELTIC.id) return;
      set(s => {
        const followed = { ...s.followed };
        delete followed[id];
        return { followed };
      });
    },
    isFollowed: id => Boolean(get().followed[id]),
    toggleComp: id => set(s => ({
      hiddenComps: s.hiddenComps.includes(id)
        ? s.hiddenComps.filter(x => x !== id)
        : [...s.hiddenComps, id],
    })),
  }),
  { name: 'mdf-prefs' },
));
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/store`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/store
git commit -m "feat: preferences store — followed clubs (Celtic fixed) and hidden competitions"
```

---

### Task 10: UI primitives

**Files:**
- Create: `src/ui/Crest.jsx`, `src/ui/SectionLabel.jsx`, `src/ui/StatusWord.jsx`, `src/ui/FixtureRow.jsx`
- Test: `src/ui/ui.test.jsx`

**Interfaces:**
- Consumes: `Fixture`/`Side` shapes (Task 3).
- Produces:
  - `<Crest side size?>` — `side` is any object with `{crestUrl, monogram, name}`.
  - `<SectionLabel muted?>children</SectionLabel>`.
  - `<StatusWord fixture>` — kickoff time (en-GB HH:mm) / red live minute / FT / P–P.
  - `<FixtureRow fixture followedIds>` — `followedIds: Set<string>`; links to `/match/{compId}/{id}`; a followed side shows ★.

- [ ] **Step 1: failing tests**

`src/ui/ui.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Crest from './Crest.jsx';
import StatusWord from './StatusWord.jsx';
import FixtureRow from './FixtureRow.jsx';

const side = (over = {}) => ({
  teamId: '10603', name: 'Auchinleck Talbot', shortName: 'Talbot',
  crestUrl: null, monogram: 'AT', colour: null, score: null, ...over,
});

test('Crest renders an img when a crest exists', () => {
  render(<Crest side={side({ crestUrl: 'x.png', name: 'Celtic' })} />);
  expect(screen.getByRole('img', { name: 'Celtic' })).toHaveAttribute('src', 'x.png');
});

test('Crest falls back to the monogram disc when crestUrl is null', () => {
  render(<Crest side={side()} />);
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('AT')).toBeInTheDocument();
});

const fixture = (status, over = {}) => ({
  id: 'e1', compId: 'sco.1', kickoff: '2026-08-22T14:00:00Z', status,
  minute: null, round: null, venue: null,
  home: side({ teamId: '256', name: 'Celtic', crestUrl: 'c.png' }),
  away: side({ teamId: '267', name: 'St Johnstone' }),
  ...over,
});

test('StatusWord: scheduled shows kickoff, live shows the minute, postponed shows P–P', () => {
  const { rerender } = render(<StatusWord fixture={fixture('scheduled')} />);
  expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  rerender(<StatusWord fixture={fixture('live', { minute: "63'" })} />);
  expect(screen.getByText("63'")).toBeInTheDocument();
  rerender(<StatusWord fixture={fixture('postponed')} />);
  expect(screen.getByText('P–P')).toBeInTheDocument();
  rerender(<StatusWord fixture={fixture('ft')} />);
  expect(screen.getByText('FT')).toBeInTheDocument();
});

test('FixtureRow links to the match and stars a followed side', () => {
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft', {
        home: side({ teamId: '256', name: 'Celtic', crestUrl: 'c.png', score: 2 }),
        away: side({ teamId: '267', name: 'St Johnstone', score: 0 }),
      })} followedIds={new Set(['256'])} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link')).toHaveAttribute('href', '/match/sco.1/e1');
  expect(screen.getByText('★')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/ui/ui.test.jsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: implement**

`src/ui/Crest.jsx`:

```jsx
// Crest with monogram fallback (spec §8.5). Crestless clubs are a
// normal case — 58 of 60 Scottish Cup first-round entrants — never an
// error state.
export default function Crest({ side, size = 22 }) {
  if (side.crestUrl) {
    return (
      <img src={side.crestUrl} alt={side.name} width={size} height={size}
        loading="lazy" className="shrink-0 object-contain" />
    );
  }
  return (
    <span
      aria-label={side.name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className="shrink-0 rounded-full border border-rule bg-paper text-muted font-serif
                 inline-flex items-center justify-center leading-none"
    >
      {side.monogram}
    </span>
  );
}
```

`src/ui/SectionLabel.jsx`:

```jsx
export default function SectionLabel({ children, muted = false }) {
  return (
    <h2 className={`font-sans text-[10px] font-semibold uppercase tracking-[.2em] pb-2 mb-4 border-b ${
      muted ? 'text-muted border-rule' : 'text-accent border-ink'
    }`}>
      {children}
    </h2>
  );
}
```

`src/ui/StatusWord.jsx`:

```jsx
const kickoffTime = iso =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function StatusWord({ fixture }) {
  if (fixture.status === 'live') {
    return (
      <span className="font-sans text-[10px] uppercase tracking-[.14em] text-accent
                       inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
        {fixture.minute ?? 'Live'}
      </span>
    );
  }
  if (fixture.status === 'ft') {
    return <span className="font-sans text-[11px] text-muted">FT</span>;
  }
  if (fixture.status === 'postponed' || fixture.status === 'canceled') {
    return (
      <span className="font-sans text-[9px] uppercase tracking-[.14em] text-muted/70">P–P</span>
    );
  }
  return (
    <span className="font-sans text-[11px] text-muted tabular-nums">
      {kickoffTime(fixture.kickoff)}
    </span>
  );
}
```

`src/ui/FixtureRow.jsx`:

```jsx
import { Link } from 'react-router-dom';
import Crest from './Crest.jsx';
import StatusWord from './StatusWord.jsx';

function TeamLine({ side, followed, dim }) {
  return (
    <div className={`flex items-center gap-2.5 ${dim ? 'opacity-50' : ''}`}>
      <Crest side={side} size={22} />
      <span className="font-serif text-[15px] truncate flex-1">
        {side.name}
        {followed && <span className="text-accent text-[9px] align-middle ml-1.5">★</span>}
      </span>
      {side.score != null && (
        <span className="font-serif text-[17px] tabular-nums">{side.score}</span>
      )}
    </div>
  );
}

export default function FixtureRow({ fixture, followedIds = new Set() }) {
  const dim = fixture.status === 'postponed' || fixture.status === 'canceled';
  return (
    <Link to={`/match/${fixture.compId}/${fixture.id}`}
      className="block py-3 border-b border-rule/70">
      <div className="flex items-start gap-3">
        <div className="w-12 shrink-0 pt-1"><StatusWord fixture={fixture} /></div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <TeamLine side={fixture.home} followed={followedIds.has(fixture.home.teamId)} dim={dim} />
          <TeamLine side={fixture.away} followed={followedIds.has(fixture.away.teamId)} dim={dim} />
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/ui`
Expected: all UI tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Crest.jsx src/ui/SectionLabel.jsx src/ui/StatusWord.jsx src/ui/FixtureRow.jsx src/ui/ui.test.jsx
git commit -m "feat: Broadsheet UI primitives — Crest, SectionLabel, StatusWord, FixtureRow"
```

---

### Task 11: Today screen

**Files:**
- Create: `src/features/today/partition.js`, `src/features/today/TodayView.jsx`, `src/features/today/TodayScreen.jsx`
- Modify: `src/App.jsx` (replace the Today stub)
- Test: `src/features/today/partition.test.js`, `src/features/today/TodayView.test.jsx`

**Interfaces:**
- Consumes: `useTodayWindows` (Task 8), `usePrefs` (Task 9), `FixtureRow`/`SectionLabel` (Task 10), `COMPETITIONS` (Task 2).
- Produces: `partitionToday(fixtures, followedIds, now) → { yours, live, later, earlier, yesterday }` (each `Fixture[]`); `<TodayView partition followedIds date asOf?>`; default-export `TodayScreen` wired into the `/` route.

- [ ] **Step 1: failing tests**

`src/features/today/partition.test.js`:

```js
import { partitionToday } from './partition.js';

const side = teamId => ({ teamId, name: teamId, crestUrl: null, monogram: 'XX', score: null });
const fx = (id, kickoff, status, h, a) =>
  ({ id, compId: 'sco.1', kickoff, status, minute: null, home: side(h), away: side(a) });

const now = new Date('2026-08-22T15:30:00Z');
const fixtures = [
  fx('1', '2026-08-22T14:00:00Z', 'live', '256', '267'),      // Celtic live — followed
  fx('2', '2026-08-22T14:00:00Z', 'live', '260', '258'),      // other live
  fx('3', '2026-08-22T16:45:00Z', 'scheduled', '261', '264'), // later today
  fx('4', '2026-08-22T11:00:00Z', 'ft', '266', '263'),        // finished earlier today
  fx('5', '2026-08-21T14:00:00Z', 'ft', '250', '256'),        // yesterday, followed
  fx('6', '2026-08-21T14:00:00Z', 'ft', '254', '262'),        // yesterday
  fx('7', '2026-08-22T14:00:00Z', 'postponed', '999', '998'), // postponed today
];
const followed = new Set(['256']);

test('followed clubs go to yours regardless of status', () => {
  const p = partitionToday(fixtures, followed, now);
  expect(p.yours.map(f => f.id)).toEqual(['1']);
  expect(p.live.map(f => f.id)).toEqual(['2']); // not the followed one
});

test('today splits into later and earlier; postponed sits with earlier', () => {
  const p = partitionToday(fixtures, followed, now);
  expect(p.later.map(f => f.id)).toEqual(['3']);
  expect(p.earlier.map(f => f.id)).toEqual(['4', '7']);
});

test('yesterday is separate, followed clubs first', () => {
  const p = partitionToday(fixtures, followed, now);
  expect(p.yesterday.map(f => f.id)).toEqual(['5', '6']);
});

test('a quiet day yields empty sections, not crashes', () => {
  const p = partitionToday([], followed, now);
  expect(p.yours).toEqual([]);
  expect(p.live).toEqual([]);
});
```

`src/features/today/TodayView.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TodayView from './TodayView.jsx';

const side = (teamId, name) => ({ teamId, name, crestUrl: null, monogram: 'XX', score: 1 });
const fx = (id, h, a, status = 'ft') => ({
  id, compId: 'sco.1', kickoff: '2026-08-22T14:00:00Z', status, minute: null,
  home: side('h' + id, h), away: side('a' + id, a),
});

test('renders sections it has and the masthead date, skips empty sections', () => {
  render(
    <MemoryRouter>
      <TodayView
        date={new Date('2026-08-22T15:00:00Z')}
        followedIds={new Set()}
        partition={{ yours: [fx('1', 'Celtic', 'St Johnstone')], live: [],
          later: [], earlier: [], yesterday: [fx('2', 'Falkirk', 'Hearts')] }}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/Saturday 22 August/)).toBeInTheDocument();
  expect(screen.getByText('★ Your clubs')).toBeInTheDocument();
  expect(screen.getByText('Yesterday')).toBeInTheDocument();
  expect(screen.queryByText('Live')).toBeNull();
  expect(screen.queryByText('Later today')).toBeNull();
});

test('a completely quiet day says so', () => {
  render(
    <MemoryRouter>
      <TodayView date={new Date('2026-06-15T12:00:00Z')} followedIds={new Set()}
        partition={{ yours: [], live: [], later: [], earlier: [], yesterday: [] }} />
    </MemoryRouter>,
  );
  expect(screen.getByText('No matches today.')).toBeInTheDocument();
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/features/today`
Expected: FAIL — modules not found.

- [ ] **Step 3: implement**

`src/features/today/partition.js`:

```js
// Sorts the two-day fixture window into the Today sections (spec §7.2).
// Followed clubs are pulled out first — prioritise, never hide.
export function partitionToday(fixtures, followedIds, now = new Date()) {
  const todayKey = now.toDateString();
  const isToday = f => new Date(f.kickoff).toDateString() === todayKey;
  const isFollowed = f => followedIds.has(f.home.teamId) || followedIds.has(f.away.teamId);
  const byKickoff = (a, b) => new Date(a.kickoff) - new Date(b.kickoff);
  const liveFirst = f => (f.status === 'live' ? 0 : 1);

  const today = fixtures.filter(isToday);
  const rest = today.filter(f => !isFollowed(f));
  return {
    yours: today.filter(isFollowed)
      .sort((a, b) => liveFirst(a) - liveFirst(b) || byKickoff(a, b)),
    live: rest.filter(f => f.status === 'live').sort(byKickoff),
    later: rest.filter(f => f.status === 'scheduled').sort(byKickoff),
    earlier: rest.filter(f => ['ft', 'postponed', 'canceled'].includes(f.status))
      .sort(byKickoff),
    yesterday: fixtures.filter(f => !isToday(f))
      .sort((a, b) => (isFollowed(b) ? 1 : 0) - (isFollowed(a) ? 1 : 0) || byKickoff(a, b)),
  };
}
```

`src/features/today/TodayView.jsx`:

```jsx
import SectionLabel from '../../ui/SectionLabel.jsx';
import FixtureRow from '../../ui/FixtureRow.jsx';

const longDate = d => d.toLocaleDateString('en-GB',
  { weekday: 'long', day: 'numeric', month: 'long' });

function Section({ label, muted, fixtures, followedIds }) {
  if (!fixtures.length) return null;
  return (
    <section className="mt-8 first:mt-0">
      <SectionLabel muted={muted}>{label}</SectionLabel>
      {fixtures.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} />)}
    </section>
  );
}

export default function TodayView({ partition, followedIds, date, asOf = null }) {
  const { yours, live, later, earlier, yesterday } = partition;
  const quiet = !yours.length && !live.length && !later.length && !earlier.length;
  return (
    <main>
      <p className="font-sans text-[11px] uppercase tracking-[.22em] text-muted">
        {longDate(date)}
      </p>
      <h1 className="text-[27px] mb-8">Today</h1>
      {asOf && (
        <p className="font-sans text-[10px] text-muted mb-6">
          as of {new Date(asOf).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      <Section label="★ Your clubs" fixtures={yours} followedIds={followedIds} />
      <Section label="Live" fixtures={live} followedIds={followedIds} />
      <Section label="Later today" muted fixtures={later} followedIds={followedIds} />
      <Section label="Earlier today" muted fixtures={earlier} followedIds={followedIds} />
      {quiet && <p className="text-muted mt-2">No matches today.</p>}
      <Section label="Yesterday" muted fixtures={yesterday} followedIds={followedIds} />
    </main>
  );
}
```

`src/features/today/TodayScreen.jsx`:

```jsx
import { COMPETITIONS } from '../../domain/competitions.js';
import { useTodayWindows } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import { partitionToday } from './partition.js';
import TodayView from './TodayView.jsx';

export default function TodayScreen() {
  const followed = usePrefs(s => s.followed);
  const hidden = usePrefs(s => s.hiddenComps);
  const comps = COMPETITIONS.filter(c => !hidden.includes(c.id));
  const results = useTodayWindows(comps);

  const followedIds = new Set(Object.keys(followed));
  const fixtures = results.flatMap(r => r.data?.fixtures ?? []);
  const asOf = results.map(r => r.data?.asOf).find(Boolean) ?? null;
  const loading = results.every(r => r.isLoading);

  if (loading) return <p className="text-muted">Fetching today's football…</p>;
  return (
    <TodayView
      partition={partitionToday(fixtures, followedIds, new Date())}
      followedIds={followedIds}
      date={new Date()}
      asOf={asOf}
    />
  );
}
```

In `src/App.jsx`, replace the Today stub:

```jsx
import TodayScreen from './features/today/TodayScreen.jsx';
// ...
<Route index element={<TodayScreen />} />
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/features/today src/test/smoke.test.jsx`
Expected: partition and view tests pass; smoke test still passes.
Then `npm run dev` — the home screen shows real fixtures pulled through the proxy. Verify a followed Celtic fixture (if one is in the window) appears under "★ Your clubs".

- [ ] **Step 5: Commit**

```bash
git add src/features/today src/App.jsx
git commit -m "feat: Today screen — live, your clubs, later, yesterday"
```

---

### Task 12: Competitions index and competition screen with league table

**Files:**
- Create: `src/features/competitions/CompetitionsScreen.jsx`, `src/features/competition/zones.js`, `src/features/competition/LeagueTable.jsx`, `src/features/competition/CompetitionScreen.jsx`
- Modify: `src/App.jsx` (replace two stubs)
- Test: `src/features/competition/zones.test.js`, `src/features/competition/LeagueTable.test.jsx`

**Interfaces:**
- Consumes: `useTable`/`useSeasonFixtures` (Task 8), `formGuide` (Task 5), `byId`/`COMPETITION_GROUPS` (Task 2), `Crest` (Task 10), `usePrefs` (Task 9).
- Produces: `ZONE_META` `{zoneKey: {colour, label}}`; `zoneFor(comp, position) → zoneKey|null`; `<LeagueTable rows comp followedIds formByTeam>` (`formByTeam: {teamId: ('W'|'D'|'L')[]}`); routes `/competitions` and `/competition/:compId` live.

- [ ] **Step 1: failing tests**

`src/features/competition/zones.test.js`:

```js
import { zoneFor, ZONE_META } from './zones.js';
import { byId } from '../../domain/competitions.js';

test('zoneFor reads the competition zone map', () => {
  expect(zoneFor(byId('sco.1'), 1)).toBe('ucl');
  expect(zoneFor(byId('sco.1'), 5)).toBeNull();
  expect(zoneFor(byId('sco.1'), 12)).toBe('rel');
  expect(zoneFor(byId('uefa.champions'), 24)).toBe('po');
});

test('every zone key used by any competition has metadata', () => {
  expect(Object.keys(ZONE_META).sort()).toEqual(['adv', 'po', 'promo', 'rel', 'ucl', 'uecl']);
  for (const meta of Object.values(ZONE_META)) {
    expect(meta.colour).toMatch(/^#/);
    expect(meta.label.length).toBeGreaterThan(2);
  }
});
```

`src/features/competition/LeagueTable.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LeagueTable from './LeagueTable.jsx';
import { byId } from '../../domain/competitions.js';

const row = (position, name, over = {}) => ({
  teamId: name, name, crestUrl: null, monogram: name.slice(0, 2).toUpperCase(),
  position, played: 38, won: 24, drawn: 8, lost: 6, goalsFor: 67, goalsAgainst: 34,
  goalDifference: 33, points: 80, deduction: 0, ...over,
});
const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, 'Team' + (i + 1)));

test('tap a row to open its record; tap again to close', async () => {
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set()}
      formByTeam={{ Team2: ['W', 'W', 'D', 'W', 'L'] }} />
  </MemoryRouter>);
  expect(screen.queryByText('GF')).toBeNull();
  await userEvent.click(screen.getByText('Team2'));
  expect(screen.getByText('GF')).toBeInTheDocument();
  expect(screen.getByText('67')).toBeInTheDocument(); // goals for in the drawer
  await userEvent.click(screen.getByText('Team2'));
  expect(screen.queryByText('GF')).toBeNull();
});

test('the split renders after 6th in the Premiership and a deduction is stated', async () => {
  const withDeduction = rows.map(r =>
    r.position === 8 ? { ...r, deduction: -5 } : r);
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={withDeduction} followedIds={new Set()}
      formByTeam={{}} />
  </MemoryRouter>);
  expect(screen.getByText('The split')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Team8'));
  expect(screen.getByText('5-point deduction applied')).toBeInTheDocument();
});

test('no split line for competitions without one', () => {
  render(<MemoryRouter>
    <LeagueTable comp={byId('eng.1')} rows={rows} followedIds={new Set()} formByTeam={{}} />
  </MemoryRouter>);
  expect(screen.queryByText('The split')).toBeNull();
});

test('followed club carries its star', () => {
  render(<MemoryRouter>
    <LeagueTable comp={byId('sco.1')} rows={rows} followedIds={new Set(['Team3'])}
      formByTeam={{}} />
  </MemoryRouter>);
  expect(screen.getByText('★')).toBeInTheDocument();
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/features/competition`
Expected: FAIL — modules not found.

- [ ] **Step 3: implement**

`src/features/competition/zones.js`:

```js
// Zone tick colours and legend labels (spec §7.3). 2px ticks in the
// margin — never coloured row backgrounds.
export const ZONE_META = {
  ucl: { colour: '#1B4F9C', label: 'Champions League' },
  uecl: { colour: '#3E8E7E', label: 'Conference League' },
  adv: { colour: '#1B4F9C', label: 'Advance' },
  promo: { colour: '#1B4F9C', label: 'Promotion' },
  po: { colour: '#C98A1B', label: 'Play-off' },
  rel: { colour: '#A11B1B', label: 'Relegation' },
};

export const zoneFor = (comp, position) => comp.zones?.[position] ?? null;
```

`src/features/competition/LeagueTable.jsx`:

```jsx
// The T1 table (spec §7.3): four permanent columns, tap a row to open
// its full record in a drawer. The split is drawn as a real event.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Crest from '../../ui/Crest.jsx';
import { ZONE_META, zoneFor } from './zones.js';

function FormGlyphs({ form }) {
  if (!form?.length) return null;
  return (
    <div className="flex items-center gap-1.5 mt-4">
      <span className="font-sans text-[8.5px] uppercase tracking-[.14em] text-muted mr-1">Form</span>
      {form.map((r, i) => (
        <span key={i} className={`w-[17px] h-[17px] rounded-full font-sans text-[9px] font-semibold
          inline-flex items-center justify-center ${
            r === 'W' ? 'bg-ink text-paper'
            : r === 'D' ? 'bg-rule text-muted'
            : 'border border-rule text-muted'
          }`}>
          {r}
        </span>
      ))}
    </div>
  );
}

function Drawer({ row, form }) {
  const cells = [
    ['P', row.played], ['W', row.won], ['D', row.drawn],
    ['L', row.lost], ['GF', row.goalsFor], ['GA', row.goalsAgainst],
  ];
  return (
    <div className="bg-drawer -mx-5 px-5 py-4">
      <div className="grid grid-cols-6 gap-x-1 gap-y-2 text-center">
        {cells.map(([k, v]) => (
          <div key={k}>
            <div className="font-sans text-[8.5px] uppercase tracking-[.14em] text-muted">{k}</div>
            <div className="text-[16px] tabular-nums mt-0.5">{v}</div>
          </div>
        ))}
      </div>
      {row.deduction !== 0 && (
        <p className="font-sans text-[10px] text-accent mt-3">
          {Math.abs(row.deduction)}-point deduction applied
        </p>
      )}
      <FormGlyphs form={form} />
      <Link to={`/team/${row.compId ?? ''}/${row.teamId}`}
        className="font-sans text-[9.5px] uppercase tracking-[.14em] text-muted underline
                   underline-offset-4 inline-block mt-4">
        Team page
      </Link>
    </div>
  );
}

export default function LeagueTable({ comp, rows, followedIds, formByTeam }) {
  const [openId, setOpenId] = useState(null);
  const usedZones = [...new Set(rows.map(r => zoneFor(comp, r.position)).filter(Boolean))];
  return (
    <div>
      {rows.map(row => (
        <div key={row.teamId}>
          {comp.splitAfter === row.position - 1 && (
            <div className="flex items-center gap-2.5 my-3.5">
              <i className="flex-1 h-px bg-accent/40" />
              <span className="font-sans text-[9px] uppercase tracking-[.2em] text-accent">
                The split
              </span>
              <i className="flex-1 h-px bg-accent/40" />
            </div>
          )}
          <button type="button"
            onClick={() => setOpenId(openId === row.teamId ? null : row.teamId)}
            className="w-full text-left flex items-center gap-3 py-3 border-b border-rule/70">
            <span className="w-0.5 self-stretch rounded-sm -mr-1"
              style={{ background: ZONE_META[zoneFor(comp, row.position)]?.colour ?? 'transparent' }} />
            <span className="w-5 font-sans text-[12px] text-muted tabular-nums shrink-0">
              {row.position}
            </span>
            <Crest side={row} size={22} />
            <span className="flex-1 min-w-0 truncate text-[15px]">
              {row.name}
              {followedIds.has(row.teamId) && (
                <span className="text-accent text-[9px] align-middle ml-1.5">★</span>
              )}
            </span>
            <span className="text-[17px] tabular-nums">{row.points}</span>
          </button>
          {openId === row.teamId && (
            <Drawer row={{ ...row, compId: comp.id }} form={formByTeam[row.teamId]} />
          )}
        </div>
      ))}
      {usedZones.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-5 pt-4 border-t border-rule
                        font-sans text-[9.5px] text-muted">
          {usedZones.map(z => (
            <span key={z} className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-[2px]" style={{ background: ZONE_META[z].colour }} />
              {ZONE_META[z].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

`src/features/competitions/CompetitionsScreen.jsx`:

```jsx
import { Link } from 'react-router-dom';
import { COMPETITION_GROUPS } from '../../domain/competitions.js';
import { usePrefs } from '../../store/prefs.js';
import SectionLabel from '../../ui/SectionLabel.jsx';

export default function CompetitionsScreen() {
  const hidden = usePrefs(s => s.hiddenComps);
  return (
    <main>
      <h1 className="text-[27px] mb-8">Competitions</h1>
      {COMPETITION_GROUPS.map(([country, comps]) => {
        const visible = comps.filter(c => !hidden.includes(c.id));
        if (!visible.length) return null;
        return (
          <section key={country} className="mt-8 first:mt-0">
            <SectionLabel muted>{country}</SectionLabel>
            {visible.map(c => (
              <Link key={c.id} to={`/competition/${c.id}`}
                className="flex items-baseline justify-between py-3.5 border-b border-rule/70">
                <span className="text-[16px]">{c.name}</span>
                <span className="font-sans text-[10px] uppercase tracking-[.14em] text-muted">
                  {c.type}
                </span>
              </Link>
            ))}
          </section>
        );
      })}
    </main>
  );
}
```

`src/features/competition/CompetitionScreen.jsx`:

```jsx
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { byId } from '../../domain/competitions.js';
import { formGuide } from '../../domain/form.js';
import { useSeasonFixtures, useTable } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import FixtureRow from '../../ui/FixtureRow.jsx';
import LeagueTable from './LeagueTable.jsx';

const groupByDate = fixtures => {
  const groups = new Map();
  for (const f of fixtures) {
    const day = new Date(f.kickoff).toLocaleDateString('en-GB',
      { weekday: 'short', day: 'numeric', month: 'short' });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(f);
  }
  return [...groups.entries()];
};

export default function CompetitionScreen() {
  const { compId } = useParams();
  const comp = byId(compId);
  const tabs = [...(comp?.hasTable ? ['Table'] : []), 'Fixtures', 'Results'];
  const [tab, setTab] = useState(tabs[0]);
  const followedIds = new Set(Object.keys(usePrefs(s => s.followed)));
  const table = useTable(comp ?? { id: 'none', hasTable: false, source: 'espn' });
  const season = useSeasonFixtures(comp ?? { id: 'none', source: 'espn' });

  const formByTeam = useMemo(() => {
    const fixtures = table.data?.fixtures ?? [];
    const map = {};
    for (const r of table.data?.rows ?? []) map[r.teamId] = formGuide(fixtures, r.teamId);
    return map;
  }, [table.data]);

  if (!comp) return <p className="text-muted">Unknown competition.</p>;
  const fixtures = season.data?.fixtures ?? [];
  const upcoming = fixtures.filter(f => ['scheduled', 'live', 'postponed'].includes(f.status))
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const results = fixtures.filter(f => f.status === 'ft')
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff));

  return (
    <main>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-muted">{comp.country}</p>
      <h1 className="text-[25px] mb-6">{comp.name}</h1>
      <div className="flex border border-ink rounded-sm overflow-hidden mb-6 font-sans">
        {tabs.map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[9.5px] uppercase tracking-[.1em] ${
              tab === t ? 'bg-ink text-paper' : 'text-ink'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Table' && (table.data
        ? <LeagueTable comp={comp} rows={table.data.rows}
            followedIds={followedIds} formByTeam={formByTeam} />
        : <p className="text-muted">{table.isError ? 'Table unavailable.' : 'Loading table…'}</p>)}
      {tab === 'Fixtures' && groupByDate(upcoming).map(([day, list]) => (
        <section key={day} className="mb-6">
          <p className="font-sans text-[9.5px] uppercase tracking-[.18em] text-muted mb-2">{day}</p>
          {list.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} />)}
        </section>
      ))}
      {tab === 'Results' && groupByDate(results).map(([day, list]) => (
        <section key={day} className="mb-6">
          <p className="font-sans text-[9.5px] uppercase tracking-[.18em] text-muted mb-2">{day}</p>
          {list.map(f => <FixtureRow key={f.id} fixture={f} followedIds={followedIds} />)}
        </section>
      ))}
    </main>
  );
}
```

In `src/App.jsx` replace the two stubs:

```jsx
import CompetitionsScreen from './features/competitions/CompetitionsScreen.jsx';
import CompetitionScreen from './features/competition/CompetitionScreen.jsx';
// ...
<Route path="competitions" element={<CompetitionsScreen />} />
<Route path="competition/:compId" element={<CompetitionScreen />} />
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/features/competition src/test/smoke.test.jsx`
Expected: zones + LeagueTable tests pass; smoke passes.
`npm run dev`: open `/competition/sco.1` — real table, split after 6th, tap rows for drawers. Open `/competition/scottish-league-one` — a computed table. Open `/competition/uefa.champions` — 36 rows.

- [ ] **Step 5: Commit**

```bash
git add src/features/competitions src/features/competition src/App.jsx
git commit -m "feat: competitions index and competition screen with tap-to-open table"
```

---

### Task 13: Team screen

**Files:**
- Create: `src/features/team/teamFixtures.js`, `src/features/team/TeamScreen.jsx`
- Modify: `src/App.jsx` (replace the Team stub)
- Test: `src/features/team/teamFixtures.test.js`

**Interfaces:**
- Consumes: `useAllSeasonFixtures`/`useSquad`/`useTeams` (Task 8), `formGuide` (Task 5), `usePrefs` (Task 9), `byId`/`COMPETITIONS` (Task 2), `Crest`/`FixtureRow`/`SectionLabel` (Task 10).
- Produces: `teamFixtures(allFixtures, teamId, now?) → { all, next, last }`; route `/team/:compId/:teamId` live. `all` is every fixture involving the team across all queried competitions, kickoff ascending.

- [ ] **Step 1: failing tests**

`src/features/team/teamFixtures.test.js`:

```js
import { teamFixtures } from './teamFixtures.js';

const side = (teamId, score = null) => ({ teamId, name: teamId, score });
const fx = (id, kickoff, status, h, a) => ({ id, kickoff, status, home: side(h), away: side(a) });

const now = new Date('2026-08-22T12:00:00Z');
const all = [
  fx('1', '2026-08-01T14:00:00Z', 'ft', 'CEL', 'RAN'),
  fx('2', '2026-08-29T14:00:00Z', 'scheduled', 'ABE', 'CEL'),
  fx('3', '2026-08-15T14:00:00Z', 'ft', 'CEL', 'HEA'),
  fx('4', '2026-09-05T14:00:00Z', 'scheduled', 'CEL', 'STM'),
  fx('5', '2026-08-10T14:00:00Z', 'ft', 'DUN', 'ABE'), // not Celtic — excluded
  fx('6', '2026-08-23T14:00:00Z', 'postponed', 'CEL', 'KIL'), // postponed is not "next"
];

test('filters to the team and sorts by kickoff', () => {
  const t = teamFixtures(all, 'CEL', now);
  expect(t.all.map(f => f.id)).toEqual(['1', '3', '6', '2', '4']);
});

test('next is the first future scheduled fixture; last is the most recent result', () => {
  const t = teamFixtures(all, 'CEL', now);
  expect(t.next.id).toBe('2');
  expect(t.last.id).toBe('3');
});

test('a team with nothing upcoming or played gives nulls, not crashes', () => {
  expect(teamFixtures([], 'CEL', now)).toEqual({ all: [], next: null, last: null });
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/features/team`
Expected: FAIL — module not found.

- [ ] **Step 3: implement**

`src/features/team/teamFixtures.js`:

```js
// A team's season across every competition we cover (spec §7.5).
export function teamFixtures(allFixtures, teamId, now = new Date()) {
  const all = allFixtures
    .filter(f => f.home.teamId === teamId || f.away.teamId === teamId)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const next = all.find(f => f.status === 'scheduled' && new Date(f.kickoff) >= now) ?? null;
  const last = [...all].reverse().find(f => f.status === 'ft') ?? null;
  return { all, next, last };
}
```

`src/features/team/TeamScreen.jsx`:

```jsx
import { useParams } from 'react-router-dom';
import { COMPETITIONS, byId } from '../../domain/competitions.js';
import { formGuide } from '../../domain/form.js';
import { useAllSeasonFixtures, useSquad, useTeams } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import Crest from '../../ui/Crest.jsx';
import FixtureRow from '../../ui/FixtureRow.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import { teamFixtures } from './teamFixtures.js';

function FollowButton({ team }) {
  const { follow, unfollow } = usePrefs();
  const followed = usePrefs(s => Boolean(s.followed[team.id]));
  const fixed = team.id === '256';
  return (
    <button type="button" disabled={fixed}
      onClick={() => (followed ? unfollow(team.id) : follow(team))}
      className={`font-sans text-[9.5px] uppercase tracking-[.14em] border rounded-full
        px-4 py-2 ${followed ? 'bg-ink text-paper border-ink' : 'text-ink border-ink'}`}>
      {fixed ? '★ Your club' : followed ? '★ Following' : '☆ Follow'}
    </button>
  );
}

export default function TeamScreen() {
  const { compId, teamId } = useParams();
  const comp = byId(compId);
  const teams = useTeams(comp ?? { id: 'none', source: 'bbc' });
  const seasons = useAllSeasonFixtures(COMPETITIONS);
  const squad = useSquad(comp, teamId);

  const allFixtures = seasons.flatMap(r => r.data?.fixtures ?? []);
  const { all, next, last } = teamFixtures(allFixtures, teamId);
  // Team identity: teams endpoint when the source has one, else from any fixture.
  const fromFixture = all[0]
    ? (all[0].home.teamId === teamId ? all[0].home : all[0].away) : null;
  const team = teams.data?.teams.find(t => t.id === teamId) ?? fromFixture;

  if (!team) return <p className="text-muted">Loading team…</p>;
  return (
    <main>
      <div className="flex items-center gap-4 mb-2">
        <Crest side={team} size={46} />
        <div className="flex-1 min-w-0">
          <h1 className="text-[24px] truncate">{team.name}</h1>
        </div>
        <FollowButton team={{ id: teamId, name: team.name, crestUrl: team.crestUrl ?? null,
          monogram: team.monogram, colour: team.colour ?? null }} />
      </div>
      <p className="font-sans text-[10px] uppercase tracking-[.18em] text-muted mb-8">
        {comp?.name ?? ''}
        {formGuide(allFixtures, teamId).length > 0 &&
          ` · ${formGuide(allFixtures, teamId).join(' ')}`}
      </p>

      {next && (<section className="mb-8">
        <SectionLabel>Next</SectionLabel>
        <FixtureRow fixture={next} followedIds={new Set()} />
      </section>)}
      {last && (<section className="mb-8">
        <SectionLabel muted>Last</SectionLabel>
        <FixtureRow fixture={last} followedIds={new Set()} />
      </section>)}

      <section className="mb-8">
        <SectionLabel muted>Squad</SectionLabel>
        {comp?.hasSquads === false && (
          <p className="font-sans text-[11px] text-muted">
            Squad details aren't published for {comp.name}.
          </p>
        )}
        {comp?.hasSquads && squad.data && (
          <div>
            {squad.data.players.map(p => (
              <div key={p.id} className="flex items-baseline gap-3 py-2 border-b border-rule/60">
                <span className="w-6 font-sans text-[11px] text-muted tabular-nums text-right">
                  {p.shirt ?? '—'}
                </span>
                <span className="flex-1 text-[14.5px] truncate">{p.name}</span>
                <span className="font-sans text-[10px] uppercase text-muted">{p.position ?? ''}</span>
              </div>
            ))}
          </div>
        )}
        {comp?.hasSquads && squad.isLoading && <p className="text-muted">Loading squad…</p>}
      </section>

      <section>
        <SectionLabel muted>Season</SectionLabel>
        {all.map(f => <FixtureRow key={`${f.compId}-${f.id}`} fixture={f}
          followedIds={new Set()} />)}
      </section>
    </main>
  );
}
```

In `src/App.jsx` replace the Team stub:

```jsx
import TeamScreen from './features/team/TeamScreen.jsx';
// ...
<Route path="team/:compId/:teamId" element={<TeamScreen />} />
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/features/team src/test/smoke.test.jsx`
Expected: pass.
`npm run dev`: from the Premiership table, open a drawer → Team page. Celtic shows squad + fixtures across Premiership, cups and Europe. A League One team (navigate to `/team/scottish-league-one/{id}` via a fixture) shows the squad-unavailable line.

- [ ] **Step 5: Commit**

```bash
git add src/features/team src/App.jsx
git commit -m "feat: team screen — next/last, squad with degraded case, season fixtures"
```

---

### Task 14: Match room

**Files:**
- Create: `src/features/match/MatchRoom.jsx`, `src/features/match/MatchScreen.jsx`
- Modify: `src/App.jsx` (replace the Match stub)
- Test: `src/features/match/MatchRoom.test.jsx`

**Interfaces:**
- Consumes: `useSeasonFixtures`/`useMatchDetail` (Task 8), `byId` (Task 2), `Crest` (Task 10), `MatchDetail` shape (Task 3).
- Produces: `<MatchRoom fixture comp detail?>` (presentational; `detail` null ⇒ degraded line for BBC comps); route `/match/:compId/:eventId` live.

- [ ] **Step 1: failing tests**

`src/features/match/MatchRoom.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MatchRoom from './MatchRoom.jsx';
import { byId } from '../../domain/competitions.js';

const side = (name, score) => ({ teamId: name, name, shortName: name,
  crestUrl: null, monogram: name.slice(0, 2).toUpperCase(), colour: null, score });
const fixture = {
  id: 'e1', compId: 'sco.1', kickoff: '2026-08-22T14:00:00Z', status: 'live',
  minute: "67'", round: null, venue: 'Celtic Park',
  home: side('Celtic', 2), away: side('Rangers', 1),
};

const detail = {
  events: [
    { minute: "67'", type: 'Goal', player: 'Daizen Maeda', teamId: 'Celtic' },
    { minute: "54'", type: 'Yellow Card', player: 'James Tavernier', teamId: 'Rangers' },
  ],
  teamStats: [
    { teamId: 'Celtic', name: 'Celtic', stats: { possessionPct: '58', totalShots: '14' } },
    { teamId: 'Rangers', name: 'Rangers', stats: { possessionPct: '42', totalShots: '9' } },
  ],
  lineups: [],
};

test('renders the scoreline, minute and timeline moments', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.getByText('Celtic')).toBeInTheDocument();
  expect(screen.getAllByText(/2|1/).length).toBeGreaterThan(0);
  // "67'" appears twice — the live minute in the header and the goal in the timeline
  expect(screen.getAllByText("67'").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('Daizen Maeda')).toBeInTheDocument();
  expect(screen.getByText('Yellow Card')).toBeInTheDocument();
});

test('renders team stats when present', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={fixture} comp={byId('sco.1')} detail={detail} />
  </MemoryRouter>);
  expect(screen.getByText('Possession')).toBeInTheDocument();
  expect(screen.getByText('58%')).toBeInTheDocument();
});

test('BBC competitions get the honest degraded line, not empty shelves', () => {
  render(<MemoryRouter>
    <MatchRoom fixture={{ ...fixture, compId: 'scottish-league-one' }}
      comp={byId('scottish-league-one')} detail={null} />
  </MemoryRouter>);
  expect(screen.getByText("Detailed stats aren't published for Scottish League One."))
    .toBeInTheDocument();
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/features/match`
Expected: FAIL — modules not found.

- [ ] **Step 3: implement**

`src/features/match/MatchRoom.jsx`:

```jsx
// The match room (spec §7.6): score and clock, then a vertical timeline
// of moments newest first, then stats. Degrades to a clean scoreline
// plus one honest line where the source publishes no detail.
import Crest from '../../ui/Crest.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import StatusWord from '../../ui/StatusWord.jsx';

const STAT_LABELS = {
  possessionPct: 'Possession', totalShots: 'Shots', shotsOnTarget: 'On target',
  wonCorners: 'Corners', foulsCommitted: 'Fouls', yellowCards: 'Yellow cards',
  redCards: 'Red cards', offsides: 'Offsides', saves: 'Saves',
};

function ScoreHeader({ fixture }) {
  return (
    <header className="mb-8">
      {[fixture.home, fixture.away].map(side => (
        <div key={side.teamId} className="flex items-center gap-3 py-1.5">
          <Crest side={side} size={26} />
          <span className="flex-1 text-[19px] truncate">{side.name}</span>
          <span className="text-[30px] tabular-nums">{side.score ?? '–'}</span>
        </div>
      ))}
      <div className="mt-2"><StatusWord fixture={fixture} /></div>
      {fixture.venue && (
        <p className="font-sans text-[10px] text-muted mt-1.5">{fixture.venue}</p>
      )}
    </header>
  );
}

function Timeline({ events }) {
  if (!events?.length) return null;
  return (
    <section className="mb-8">
      <SectionLabel>The match</SectionLabel>
      {[...events].reverse().map((e, i) => (
        <div key={i} className="flex items-baseline gap-4 py-3 border-b border-rule/60">
          <span className="w-9 font-sans text-[11px] text-accent tabular-nums shrink-0">
            {e.minute}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-[15px]">{e.player ?? '—'}</span>
            <span className="font-sans text-[9.5px] uppercase tracking-[.12em] text-muted ml-2.5">
              {e.type}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}

function Stats({ teamStats }) {
  if (!teamStats) return null;
  const [h, a] = teamStats;
  const keys = Object.keys(STAT_LABELS).filter(k => h.stats[k] != null && a.stats[k] != null);
  if (!keys.length) return null;
  const hp = Number(h.stats.possessionPct ?? 50);
  return (
    <section className="mb-8">
      <SectionLabel muted>Stats</SectionLabel>
      {h.stats.possessionPct != null && (
        <div className="mb-5">
          <div className="flex justify-between font-sans text-[11px] mb-1.5">
            <span className="tabular-nums">{h.stats.possessionPct}%</span>
            <span className="text-muted uppercase text-[9px] tracking-[.14em] pt-0.5">Possession</span>
            <span className="tabular-nums">{a.stats.possessionPct}%</span>
          </div>
          <div className="h-[3px] bg-rule rounded-sm overflow-hidden">
            <i className="block h-full bg-ink" style={{ width: `${hp}%` }} />
          </div>
        </div>
      )}
      {keys.filter(k => k !== 'possessionPct').map(k => (
        <div key={k} className="flex justify-between py-2 border-b border-rule/60
                                font-sans text-[12px]">
          <span className="tabular-nums w-8">{h.stats[k]}</span>
          <span className="text-muted uppercase text-[9px] tracking-[.14em] pt-0.5">
            {STAT_LABELS[k]}
          </span>
          <span className="tabular-nums w-8 text-right">{a.stats[k]}</span>
        </div>
      ))}
    </section>
  );
}

function Lineups({ lineups, fixture }) {
  if (!lineups?.some(l => l.players.length)) return null;
  const title = ha => (ha === 'home' ? fixture.home.name : fixture.away.name);
  return (
    <section className="mb-8">
      <SectionLabel muted>Lineups</SectionLabel>
      {lineups.map(l => (
        <div key={l.homeAway} className="mb-5">
          <p className="font-sans text-[10px] uppercase tracking-[.14em] text-muted mb-2">
            {title(l.homeAway)}
          </p>
          {l.players.filter(p => p.starter).map(p => (
            <div key={p.name} className="flex items-baseline gap-3 py-1.5">
              <span className="w-6 font-sans text-[11px] text-muted tabular-nums text-right">
                {p.shirt ?? ''}
              </span>
              <span className="text-[14px]">{p.name}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

export default function MatchRoom({ fixture, comp, detail }) {
  return (
    <main>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-muted mb-5">
        {comp.name}
      </p>
      <ScoreHeader fixture={fixture} />
      {comp.hasMatchDetail
        ? (<>
            <Timeline events={detail?.events} />
            <Stats teamStats={detail?.teamStats} />
            <Lineups lineups={detail?.lineups} fixture={fixture} />
          </>)
        : (
          <p className="font-sans text-[11px] text-muted">
            Detailed stats aren't published for {comp.name}.
          </p>
        )}
    </main>
  );
}
```

`src/features/match/MatchScreen.jsx`:

```jsx
import { useParams } from 'react-router-dom';
import { byId } from '../../domain/competitions.js';
import { useMatchDetail, useSeasonFixtures } from '../../data/queries.js';
import MatchRoom from './MatchRoom.jsx';

export default function MatchScreen() {
  const { compId, eventId } = useParams();
  const comp = byId(compId);
  const season = useSeasonFixtures(comp ?? { id: 'none', source: 'espn' });
  const fixture = season.data?.fixtures.find(f => f.id === eventId);
  const detail = useMatchDetail(comp, eventId, fixture?.status === 'live');

  if (!comp) return <p className="text-muted">Unknown competition.</p>;
  if (!fixture) {
    return <p className="text-muted">{season.isLoading ? 'Loading match…' : 'Match not found.'}</p>;
  }
  return <MatchRoom fixture={fixture} comp={comp} detail={detail.data?.detail ?? null} />;
}
```

In `src/App.jsx` replace the Match stub:

```jsx
import MatchScreen from './features/match/MatchScreen.jsx';
// ...
<Route path="match/:compId/:eventId" element={<MatchScreen />} />
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run -- src/features/match src/test/smoke.test.jsx`
Expected: pass.
`npm run dev`: tap any finished Premiership result → timeline + stats + lineups. Tap a League One result → clean scoreline plus the one-line note.

- [ ] **Step 5: Commit**

```bash
git add src/features/match src/App.jsx
git commit -m "feat: match room — timeline, stats, lineups, honest degraded case"
```

---

### Task 15: Clubs screen — followed, search, competition visibility

**Files:**
- Create: `src/features/clubs/searchTeams.js`, `src/features/clubs/ClubsScreen.jsx`
- Modify: `src/App.jsx` (replace the Clubs stub)
- Test: `src/features/clubs/searchTeams.test.js`, `src/features/clubs/ClubsScreen.test.jsx`

**Interfaces:**
- Consumes: `useTeams`/`useAllSeasonFixtures` (Task 8), `usePrefs`/`CELTIC` (Task 9), `COMPETITIONS` (Task 2), `Crest`/`SectionLabel` (Task 10).
- Produces: `searchTeams(teams, q) → Team[]` (case-insensitive substring, deduped by id, max 12, empty for q shorter than 2 chars); route `/clubs` live.

- [ ] **Step 1: failing tests**

`src/features/clubs/searchTeams.test.js`:

```js
import { searchTeams } from './searchTeams.js';

const t = (id, name) => ({ id, name, shortName: name, crestUrl: null, monogram: 'XX', colour: null });
const teams = [
  t('256', 'Celtic'), t('257', 'Rangers'), t('261', 'Dundee'), t('264', 'Dundee United'),
  t('256', 'Celtic'), // duplicate id from a second competition
];

test('case-insensitive substring match', () => {
  expect(searchTeams(teams, 'dun').map(x => x.name)).toEqual(['Dundee', 'Dundee United']);
  expect(searchTeams(teams, 'CELT').map(x => x.name)).toEqual(['Celtic']);
});

test('dedupes by id across competitions', () => {
  expect(searchTeams(teams, 'celtic')).toHaveLength(1);
});

test('under two characters returns nothing', () => {
  expect(searchTeams(teams, 'c')).toEqual([]);
  expect(searchTeams(teams, '')).toEqual([]);
});

test('caps at 12 results', () => {
  const many = Array.from({ length: 30 }, (_, i) => t(String(i), `Team ${i}`));
  expect(searchTeams(many, 'team')).toHaveLength(12);
});
```

`src/features/clubs/ClubsScreen.test.jsx` — the store interaction test, with hooks stubbed so no network is involved:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { usePrefs, CELTIC } from '../../store/prefs.js';

vi.mock('../../data/queries.js', () => ({
  useAllTeams: () => [{ data: { teams: [
    { id: '254', name: 'Falkirk', shortName: 'Falkirk', crestUrl: null,
      monogram: 'FA', colour: null },
  ] } }],
  useAllSeasonFixtures: () => [],
}));

import ClubsScreen from './ClubsScreen.jsx';

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({ followed: { [CELTIC.id]: CELTIC }, hiddenComps: [] });
});

test('Celtic is listed as fixed; searching finds and follows Falkirk', async () => {
  render(<MemoryRouter><ClubsScreen /></MemoryRouter>);
  expect(screen.getByText('Celtic')).toBeInTheDocument();
  expect(screen.getByText('Your club')).toBeInTheDocument();

  await userEvent.type(screen.getByPlaceholderText('Search for a club…'), 'falk');
  await userEvent.click(await screen.findByRole('button', { name: /Follow Falkirk/ }));
  expect(usePrefs.getState().followed['254'].name).toBe('Falkirk');
});

test('competition visibility toggles write to the store', async () => {
  render(<MemoryRouter><ClubsScreen /></MemoryRouter>);
  await userEvent.click(screen.getByRole('checkbox', { name: /FA Cup/ }));
  expect(usePrefs.getState().hiddenComps).toContain('eng.fa');
});
```

- [ ] **Step 2: run to verify failure**

Run: `npm run test:run -- src/features/clubs`
Expected: FAIL — modules not found.

- [ ] **Step 3: implement**

`src/features/clubs/searchTeams.js`:

```js
// Case-insensitive club search across every competition's team list,
// deduped by id (the same club appears in league + cups + Europe).
export function searchTeams(teams, q) {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const seen = new Set();
  const out = [];
  for (const t of teams) {
    if (!t.name.toLowerCase().includes(needle) || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length === 12) break;
  }
  return out;
}
```

`src/features/clubs/ClubsScreen.jsx`:

```jsx
import { useState } from 'react';
import { COMPETITIONS } from '../../domain/competitions.js';
import { useAllSeasonFixtures, useAllTeams } from '../../data/queries.js';
import { CELTIC, usePrefs } from '../../store/prefs.js';
import Crest from '../../ui/Crest.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import { searchTeams } from './searchTeams.js';

const ESPN_COMPS = COMPETITIONS.filter(c => c.source === 'espn');
const BBC_COMPS = COMPETITIONS.filter(c => c.source === 'bbc');

// BBC teams have no /teams endpoint — derive them from season fixtures.
function bbcTeams(seasonResults) {
  const seen = new Map();
  for (const r of seasonResults) {
    for (const f of r.data?.fixtures ?? []) {
      for (const side of [f.home, f.away]) {
        if (side.teamId && !seen.has(side.teamId)) {
          seen.set(side.teamId, { id: side.teamId, name: side.name,
            shortName: side.shortName, crestUrl: null,
            monogram: side.monogram, colour: null });
        }
      }
    }
  }
  return [...seen.values()];
}

export default function ClubsScreen() {
  const [q, setQ] = useState('');
  const { follow, unfollow, toggleComp } = usePrefs();
  const followed = usePrefs(s => s.followed);
  const hidden = usePrefs(s => s.hiddenComps);

  const espnTeamResults = useAllTeams(ESPN_COMPS);
  const bbcSeasonResults = useAllSeasonFixtures(BBC_COMPS);
  const allTeams = [
    ...espnTeamResults.flatMap(r => r.data?.teams ?? []),
    ...bbcTeams(bbcSeasonResults),
  ];
  const results = searchTeams(allTeams, q);

  return (
    <main>
      <h1 className="text-[27px] mb-8">Clubs</h1>

      <section className="mb-9">
        <SectionLabel>★ Following</SectionLabel>
        {Object.values(followed).map(club => (
          <div key={club.id} className="flex items-center gap-3 py-3 border-b border-rule/70">
            <Crest side={club} size={24} />
            <span className="flex-1 text-[16px] truncate">{club.name}</span>
            {club.id === CELTIC.id
              ? <span className="font-sans text-[9px] uppercase tracking-[.14em] text-accent">
                  Your club
                </span>
              : <button type="button" onClick={() => unfollow(club.id)}
                  aria-label={`Unfollow ${club.name}`}
                  className="font-sans text-[9px] uppercase tracking-[.14em] text-muted
                             underline underline-offset-4">
                  Unfollow
                </button>}
          </div>
        ))}
      </section>

      <section className="mb-9">
        <SectionLabel muted>Find a club</SectionLabel>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search for a club…"
          className="w-full bg-transparent border-b border-ink py-2.5 font-serif text-[16px]
                     placeholder:text-muted focus:outline-none"
        />
        {results.map(t => {
          const isFollowed = Boolean(followed[t.id]);
          return (
            <div key={t.id} className="flex items-center gap-3 py-3 border-b border-rule/70">
              <Crest side={t} size={24} />
              <span className="flex-1 text-[16px] truncate">{t.name}</span>
              <button type="button"
                aria-label={`${isFollowed ? 'Unfollow' : 'Follow'} ${t.name}`}
                onClick={() => (isFollowed ? unfollow(t.id) : follow(t))}
                className="font-sans text-[9px] uppercase tracking-[.14em] underline
                           underline-offset-4 text-ink">
                {isFollowed ? '★ Following' : '☆ Follow'}
              </button>
            </div>
          );
        })}
      </section>

      <section>
        <SectionLabel muted>Competitions shown</SectionLabel>
        {COMPETITIONS.map(c => (
          <label key={c.id} className="flex items-center gap-3 py-2.5 border-b border-rule/60
                                       font-serif text-[15px]">
            <input type="checkbox" checked={!hidden.includes(c.id)}
              onChange={() => toggleComp(c.id)} aria-label={c.name}
              className="accent-[#A11B1B]" />
            <span className="flex-1">{c.name}</span>
          </label>
        ))}
      </section>
    </main>
  );
}
```

In `src/App.jsx` replace the Clubs stub:

```jsx
import ClubsScreen from './features/clubs/ClubsScreen.jsx';
// ...
<Route path="clubs" element={<ClubsScreen />} />
```

- [ ] **Step 4: run to verify pass**

Run: `npm run test:run`
Expected: the full suite passes — this is the last feature task, so run everything.
`npm run dev`: search "falk", follow Falkirk, return to Today — Falkirk fixtures now sit under ★ Your clubs. Untick a competition and confirm it leaves Today and the Competitions index.

- [ ] **Step 5: Commit**

```bash
git add src/features/clubs src/App.jsx
git commit -m "feat: clubs screen — follow/unfollow, search, competition visibility"
```

---

### Task 16: README, GitHub, Vercel

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything; this task ships it.

- [ ] **Step 1: full verification**

Run: `npm run test:run` — expected: every test passes.
Run: `npm run build` — expected: clean production build into `dist/`.
Run: `npm run preview` and click through Today → a table → a team → a match. The `/api/*` routes 404 under `preview` (no serverless shim) — screens must show their error/loading states, not white-screen.

- [ ] **Step 2: README.md**

```markdown
# MazzaDailyFootball

A personal, ad-free football app for Scottish and English club football —
fixtures, results, live scores, tables, squads — in a quality-newspaper
design language. React learning project.

**Stack:** Vite · React 19 · Tailwind · React Router · TanStack Query ·
Zustand, deployed on Vercel. Two serverless functions proxy the public
ESPN and BBC JSON feeds with edge caching. **No API keys, no accounts,
no cost.**

## Run it

    npm install
    npm run dev        # http://localhost:5173 — /api/* works via the dev shim
    npm run test:run   # full test suite
    npm run build      # production build

## Deploy

Push to GitHub, import the repo at vercel.com — no environment variables
needed. `vercel.json` maps `/api/espn/*` to the proxy and everything else
to the SPA.

## Where things live

- `api/` — the two proxies (allowlist + edge cache + last-known-good)
- `src/domain/` — competition registry, computed tables, form, monograms
- `src/data/` — source adapters (ESPN, BBC) and query hooks
- `src/features/` — one folder per screen
- `docs/superpowers/specs/` — the design spec this app implements

Data quirks worth knowing before touching `src/data/`: see spec §3.5
(the User-Agent trap, "Away at Home", round slugs, error bodies).
```

- [ ] **Step 3: create the GitHub repository and push**

```bash
git add README.md
git commit -m "docs: README"
gh repo create MazzaDailyFootball --public --source . --push
```

If `gh` is not authenticated, run `gh auth login` first (the user drives this).

- [ ] **Step 4: deploy on Vercel**

Manual step for the user, from https://vercel.com/new: import `MazzaDailyFootball`, framework preset **Vite**, no environment variables, deploy. Then open the deployment URL on a phone and check Today, a table, a match room, and that a followed club persists across a reload.

- [ ] **Step 5: tag**

```bash
git tag v0.1.0 -m "Release 1 — the daily app"
git push --tags
```

---

## Verification sweep (after all tasks)

1. `npm run test:run` — green.
2. `npm run build` — clean.
3. On the deployed URL: Today shows real fixtures; `/competition/sco.1` table splits after 6th; `/competition/scottish-league-one` table is computed and its match rooms carry the degraded line; `/competition/uefa.champions` renders 36 rows; following a club reorders Today; a reload keeps it.
4. `curl -s -D - -o /dev/null https://<deploy>/api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=20260701-20270630` — response carries `cache-control: public, s-maxage=3600, stale-while-revalidate=604800` and, on the second hit, `x-vercel-cache: HIT`.
```
