# MazzaDailyFootball

Personal, ad-free football app ("the Broadsheet"): all Scottish leagues + English Premier League,
their cups, and the three UEFA competitions. React 19 + Vite + TailwindCSS 3.4 + React Router 6 +
TanStack Query 5 + Zustand (persist key `mdf-prefs`). Deployed on Vercel
(https://mazza-daily-football.vercel.app) from `master` of github.com/magicmazuk/MazzaDailyFootball
— which must stay PUBLIC (flipping it private silently severs Vercel's access; pushes stop
deploying with no error). £0 running cost, ONE exception: `VITE_YOUTUBE_API_KEY` (gitignored
`.env.local`; referrer-locked to prod so video 403s on localhost by choice; never commit/print it).

## Commands

- `npm run dev` — Vite on 5173 (api-shim serves the real proxies locally: live data from first run)
- `npm run test:run` — Vitest (700+ tests; add `--no-file-parallelism` if workers flake; a
  Windows fork-pool flake can exit 0 while under-running — re-run short-counted files)
- `npm run build` — production build

## Architecture (data flows left to right)

`api/espn.js` + `api/bbc.js` + `api/news.js` (Vercel functions: anchored-regex allowlists, edge
cache, last-known-good; news = two BBC RSS feeds only, Object.hasOwn guard) → `src/data/`
adapters (`espn.js`, `bbc.js`, `mergeCup.js`, `player.js`, `news.js`, `tv.js`) →
`src/data/queries.js` (every TanStack hook) → `src/domain/` (pure logic: `competitions.js`
registry — the spine: ids, sources, `blurb` editorial, zones, bbcTournament, espnQualifier,
SEASON — plus `draws.js`, `field.js`, `round.js`, `table.js`, `calendar.js`) →
`src/features/<area>/` screens + `src/ui/` primitives (`Crest`, `Shirt`, `Rail`, `FixtureRow`
incl. both drawer interiors, `TvBadge`, `Collapse`, `Skeleton`).

TV listings are CURATED (`src/data/tvListings.json`) — never invent a broadcast; unverifiable
fixtures stay unlisted. Blurbs are hand-written editorial — verify per season.

## Feed lore (hard-won — believe this over intuition)

- ESPN `event.name` is "Away at Home" — ALWAYS use `homeAway`.
- Rosters/player stats exist ONLY under a club's domestic league. For OUR clubs: fallback chain
  sco.1→sco.2→eng.1. For FOREIGN clubs: `team.defaultLeague` on the teams response IS the
  discovery (spec §13.20) — but only trust slugs shaped `/^[a-z]{2,4}\.\d+$/` (ESPN also emits
  qualifier codes and "Club Friendly" there; 44% of qualifier clubs, live-sampled).
- The proxy's teams/{id} + both core athlete routes accept ANY safe slug (LEAGUE_ANY); every
  other route stays on the enumerated list. Mocked-green-but-prod-400 is the recurring failure
  class — verify NEW espn paths through the proxy, not just against espn.com.
- Own-goal events' `team.id` is ALREADY the benefiting side (8 live goals verified; tallies
  reproduce scorelines). Do NOT flip them — a fix round once did and inverted real drawers.
- `team.record` carries NO season stamp (serves last season's final table pre-season) — hence
  the scout line's "their last N games" copy; never claim "this season".
- League `season.slug` is a year-prefixed season name, not a round (`YEAR_PREFIXED` rejects it).
- UEFA qualifying lives under separate codes (`uefa.champions_qual` etc.), merged via registry.
- Never send a browser User-Agent to ESPN (403). Never cache a 200-with-error-body.
- BBC wc-data: single-day or whole-month windows only (else 400) — fan out months.
- Dual-source cups merge by nameKeys with alias stripping; re-identify BEFORE dedupe.
- Club `color` can be literally "ffffff" (Fulham/Spurs/Leeds) — every club-coloured shape needs
  the Shirt.jsx ink-outline idiom or it vanishes on paper/drawer tones.
- ESPN player headshots 404 — never rely on that feed for faces. Portraits from GOOD
  sources are permitted (user clarification 2026-08-22: the old "no portraits ever" line
  was a data note that got read as policy — it never was one).

## Design law (user-validated; do not regress)

- Tokens: paper `#FBF9F5`, ink `#17140F`, accent `#A11B1B`, rule `#E5DFD3`, muted `#8A8175`,
  drawer `#F4F0E7`. Serif content, sans labels, hairline rules, generous space.
- TYPOGRAPHY IS A CLOSED SET: reuse an existing recipe (FieldBoard sub-label, attendance meta,
  etc.) — never invent a size/tracking/weight combo. The user demanded this verbatim; tests pin
  recipe class-strings. Minutes/heights use primes (′ ″), digits get tabular-nums.
- Degraded cases say so in ONE line, never blank. Loading uses Skeleton (bars are bg-rule — NOT
  drawer-tone, which is invisible on the drawer surface), gated on isLoading (cache presence),
  never isFetching.
- Draw ceremonies: TAP-paced, never autoplay; deterministic display shuffles (`seededShuffle`/
  `scatterShuffle` — no Math.random anywhere); reveal order is the reducer's `landed` alone;
  two-leg rounds draw as pairings (`dedupePairings`); DrawScreen is EXEMPT from the motion
  system (§8 choreography is performance, not chrome).
- The motion system (spec §13.21): one house ease `--ease-house`; `.rise-in` staggered section
  entrances (mount-only); `.xfade-in` content crossfades; `Collapse` = measured-height glide.
  Collapse contracts that were EARNED, not guessed: leaving 'auto' pins a PAINTED px via direct
  DOM write (React batches same-effect setState into one commit — the pin never paints via
  state); when no transition can run (reduced motion/jsdom) settle to 'auto' instantly and DON'T
  pin (React skips the style write when state is unchanged and the pin sticks); inner measure
  div is `flow-root` (else children's collapsed margins under-measure and the settle snaps);
  accordions use LAZY-ONCE mounting (`everOpened` latches) so closes glide around real content;
  full-bleed `-mx-5` goes on the Collapse itself (its overflow-hidden clips children's negative
  margins). Everything lives in one `prefers-reduced-motion: no-preference` block.
- Favourites (Celtic '256' permanent) prioritise, never hide. Every fixture row names its
  competition + round. Player taps open the bottom sheet first, everywhere; the sheet expands
  in place to the full Splits (swipe/tap), body scroll locked while open.
- FixtureRow drawers (spec §13.22): results = the match line (goal-dot timeline + scorer
  columns + venue·attendance); upcoming = meetings ledger + club-coloured balance bar; live and
  BBC rows navigate directly. Detail fetches only on first expand.

## Workflow (established with the user; see also .superpowers/sdd/*/progress.md ledgers)

Observation wave → spec addendum in `docs/superpowers/specs/2026-08-13-mazza-daily-football-design.md`
(§13.x; current through §13.22) → briefs in `.superpowers/sdd/<date>-<name>/` → subagent
implementers (TDD, additive tests) → scoped reviews → **opus final whole-branch review with LIVE
browser verification (non-negotiable — it has caught ship-blocking bugs every single release;
motion/visual defects are INVISIBLE to jsdom)** → merge `--no-ff` → tag → push → verify the prod
bundle hash changed AND the feature renders live. Deferred minors → `docs/superpowers/BACKLOG.md`.
Design directions: the user picks from mockup options (artifact phone-frames) — present, don't
presume. Versions: v1.0.0 gold → v1.1.0 morning edition → v1.2.0 scout → v1.3.x elegance →
v1.4.0 drawers redrawn. Unbuilt user-shortlist: Golden Boot (leaders feeds), minute-by-minute
commentary, weekend planner, home/away splits, rivalry ledger.
