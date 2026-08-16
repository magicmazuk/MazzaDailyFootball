# MazzaDailyFootball

Personal, ad-free football app ("the Broadsheet"): all Scottish leagues + English Premier League,
their cups, and the three UEFA competitions. React 19 + Vite + TailwindCSS 3.4 + React Router 6 +
TanStack Query 5 + Zustand (persist key `mdf-prefs`). Deployed on Vercel
(https://mazza-daily-football.vercel.app) from `master`. Running cost £0 — free keyless feeds via
two serverless proxies, ONE exception: `VITE_YOUTUBE_API_KEY` (gitignored `.env.local`; never
commit, print, or log it).

## Commands

- `npm run dev` — Vite on 5173
- `npm run test:run` — Vitest (55+ files; add `--no-file-parallelism` if workers flake)
- `npm run build` — production build

## Architecture (data flows left to right)

`api/espn.js` + `api/bbc.js` (Vercel functions: anchored-regex allowlists, edge cache,
last-known-good fallback) → `src/data/` adapters (`espn.js`, `bbc.js`, `mergeCup.js`, `player.js`,
`tv.js`) → `src/data/queries.js` (every TanStack hook) → `src/domain/` (pure logic:
`competitions.js` registry, `draws.js`, `field.js`, `round.js`, `table.js`, `calendar.js`) →
`src/features/<area>/` screens + `src/ui/` primitives (`Crest`, `Shirt`, `Rail`, `FixtureRow`,
`TvBadge`…).

Competition registry (`src/domain/competitions.js`) is the spine: ids, sources, `blurb` editorial,
`zones`, `bbcTournament`, `espnQualifier`, season constants (`SEASON`). TV listings are a CURATED
file (`src/data/tvListings.json`) — never invent broadcast info.

## Feed lore (hard-won — believe this over intuition)

- ESPN `event.name` is "Away at Home" — ALWAYS use `homeAway`, never parse the name.
- ESPN rosters/player stats exist ONLY under a club's domestic league; `defaultLeagueCode` +
  fallback chain (sco.1→sco.2→eng.1) resolve it. Foreign UEFA clubs have no squads (accepted).
- League `season.slug` is a year-prefixed season name, not a round — `YEAR_PREFIXED` in
  `round.js` rejects it.
- UEFA qualifying lives under separate ESPN codes (`uefa.champions_qual` etc.) — merged via the
  registry's `espnQualifier`.
- Never send a browser User-Agent to ESPN (403). Never cache a 200-with-error-body.
- BBC wc-data accepts only single-day or whole-month windows (arbitrary ranges 400) — fan out
  month windows.
- Dual-source cups (BBC rounds + ESPN fixtures) merge by name keys with alias stripping
  (`mergeCup.js`) — re-identify BEFORE dedupe.
- No player headshots anywhere (feeds 404) — hence the NO-PORTRAITS rule below.

## Design law (user-validated; do not regress)

- Broadsheet tokens: paper `#FBF9F5`, ink `#17140F`, accent `#A11B1B`, rule `#E5DFD3`, muted
  `#8A8175`, drawer `#F4F0E7`. Serif headlines, sans labels, hairline rules, generous space.
- Degraded cases say so in ONE line ("Squad details unavailable.") — never blank sections.
- NO portrait circles/roundels ever. Identity is typographic or the club-coloured `Shirt`.
- Draw ceremonies are TAP-paced, never autoplay. Display order is `seededShuffle`/`scatterShuffle`
  (deterministic, no `Math.random` anywhere) so the bowl/roll-call never telegraphs pairings.
  Reveal order is the reducer's `landed` counter alone (`drawEngine.js` stays pure).
- Two-legged rounds draw as pairings (`dedupePairings`); seen-marking covers both legs
  (`roundTieIds`). Empty fetch results never latch seen-state (`seedCompIfNeeded`).
- Favourites (Celtic id '256' is permanent) prioritise, never hide. Every fixture row names its
  competition + round as links. Player taps open the bottom sheet first, everywhere.

## Workflow (established with the user)

Observation wave → spec addendum in `docs/superpowers/specs/2026-08-13-mazza-daily-football-design.md`
(§13.x) → briefs in `.superpowers/sdd/<date>-<name>/` → subagent implementers (TDD, additive
tests) → per-task scoped reviews → **opus final whole-branch review with live dev-server
verification (non-negotiable — it has caught shippable bugs every release)** → merge `--no-ff` to
master → tag → push (Vercel auto-deploys) → verify the production bundle hash changed and the
feature renders live. Deferred minors go to `docs/superpowers/BACKLOG.md`, never silently dropped.
Design directions are chosen by the user from mockup options — present, don't presume.
