# MazzaDailyFootball — Design

**Date:** 2026-08-13
**Status:** Approved, ready for implementation planning

---

## 1. Purpose

A personal football app for Scottish and English club football, built to be read rather than
endured. Existing apps bury fixtures and results under advertising and dense, cluttered layouts;
this one carries no advertising, no notifications, no social features, and no accounts. It shows
the competitions its owner actually follows, with space and typography as first-class concerns.

Secondary purpose: a substantial, enjoyable React project — the interesting work is in data
modelling, derived state and animation rather than in build configuration.

**Success looks like:** it becomes the app that gets opened on a Saturday morning out of habit,
and nothing in it ever feels cramped on a phone.

---

## 2. Goals and non-goals

### Goals

- Ad-free, spacious, consistently designed presentation of fixtures, results, tables, squads and
  live scores.
- Cover all Scottish league football, the English Premier League, every domestic cup those clubs
  play in, and all three European club competitions.
- Follow and unfollow any club; followed clubs are prioritised throughout.
- A knockout visualisation that shows who remains and who has gone, not merely a bracket.
- A knockout draw revealed as a ceremony, paced by the user.
- Run at zero recurring cost.

### Non-goals

- Push notifications of any kind. Explicitly unwanted.
- Accounts, authentication, sync across devices, or any server-side user state.
- Social features, comments, sharing.
- Betting odds, xG or advanced analytics.
- Player detail pages, head-to-head records, historical seasons *(deferred, not rejected)*.

---

## 3. Data sources

All coverage below was verified live against the real endpoints on 2026-08-13. Total recurring
cost: **£0**. No API keys, no signups, no quotas.

### 3.1 Competition coverage — 13 competitions

| # | Competition | Source | Identifier |
|---|---|---|---|
| 1 | Scottish Premiership | ESPN | `sco.1` |
| 2 | Scottish Championship | ESPN | `sco.2` |
| 3 | Scottish League One | BBC | `…tournament:scottish-league-one` |
| 4 | Scottish League Two | BBC | `…tournament:scottish-league-two` |
| 5 | Scottish Cup | ESPN | `sco.tennents` |
| 6 | Scottish League Cup | ESPN | `sco.cis` |
| 7 | Scottish League Challenge Cup | ESPN | `sco.challenge` |
| 8 | English Premier League | ESPN | `eng.1` |
| 9 | FA Cup | ESPN | `eng.fa` |
| 10 | Carabao Cup | ESPN | `eng.league_cup` |
| 11 | UEFA Champions League | ESPN | `uefa.champions` |
| 12 | UEFA Europa League | ESPN | `uefa.europa` |
| 13 | UEFA Conference League | ESPN | `uefa.europa.conf` |

### 3.2 ESPN — primary source

Public JSON, no key. Verified available:

- **Whole-season fixtures and results in one request** — 197 events for the Premiership, 380 for
  the Premier League. This is the foundation of the cost model.
- **League tables** with played, W/D/L, goals for/against, goal difference, points, points per
  game, rank change and **points deductions**.
- **Squads** — 27 players with biographical detail.
- **Match detail** — 20-player lineups per side, 14 team statistics, timed key events, commentary.
- **Crests** at 500px and **official club colours** (e.g. Celtic `#009921`, Aberdeen `#C8142F`).
- **Knockout round slugs** on cup fixtures (`fourth-round`, `fifth-round`, `quarterfinals`,
  `semifinals`, `final`), with future rounds published as `STATUS_SCHEDULED` the moment a draw is
  made.

Endpoints:

```
Scoreboard   https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard
                 ?dates=YYYYMMDD-YYYYMMDD&limit=500
Standings    https://site.api.espn.com/apis/v2/sports/soccer/{league}/standings?season=YYYY
Teams        https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/teams
Team+squad   https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/teams/{id}?enable=roster
Match detail https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary?event={id}
Crest        https://a.espncdn.com/i/teamlogos/soccer/500/{teamId}.png
```

### 3.3 BBC — Scottish League One and Two

ESPN abandoned both competitions; its last League One fixture is 27 September 2025 and there is no
2026-27 data. BBC's public JSON covers both in full — fixtures, results, kick-off times, live
status and stable team identifiers.

```
https://web-cdn.api.bbci.co.uk/wc-data/container/sport-data-scores-fixtures
    ?selectedStartDate=YYYY-MM-DD&selectedEndDate=YYYY-MM-DD&todayDate=YYYY-MM-DD
    &urn=urn:bbc:sportsdata:football:tournament:{scottish-league-one|scottish-league-two}
```

No standings endpoint was found. **League One and Two tables are computed from results** — points,
goal difference, form and position are all derivable, and this removes a dependency rather than
adding one.

### 3.4 Known data limitations

These are permanent characteristics of the sources and the design must accommodate them, not
paper over them.

1. **League One and Two have no squads, lineups or match statistics.** They carry fixtures,
   results, live scores and computed tables only.
2. **Most lower-league and junior clubs have no crest.** 58 of the 60 Scottish Cup first-round
   entrants return no logo — Auchinleck Talbot, Banks O'Dee, Bonnyrigg Rose and so on. A monogram
   system is required app-wide, not merely in the draw.
3. **Both APIs are undocumented and owe us nothing.** Shapes may change without warning. Mitigated
   by the adapter boundary (§4.3) and last-known-good caching (§4.2).

### 3.5 Implementation traps discovered

- **Do not send a spoofed browser User-Agent to ESPN.** Doing so returns HTTP 403. The default
  client User-Agent works. *(Note: the World Cup dashboard's `api/live.js` sets a browser UA — that
  pattern must not be copied here.)*
- `event.name` is formatted **"Away at Home"**, while `competitors[]` carries an explicit
  `homeAway` field. Always use `homeAway`; never parse the name.
- Cup round names live at `event.season.slug`, not on `competition.type`.
- ESPN can return **HTTP 200 with an error body** and an empty `response` array. Responses must be
  inspected before caching, or an error gets cached for the full TTL.

### 3.6 Rejected sources

- **API-Football** — the existing account is suspended; free tier is 100 requests/day.
- **TheSportsDB** — free tier truncates a season to five fixtures; full access is paid.
- **football-data.co.uk** — free CSVs covering all four Scottish tiers with shots, corners, cards
  and referee. Results only, no fixtures. Retained as a possible future backfill for tier 3–4 match
  detail; not used in either release.

---

## 4. Architecture

### 4.1 Stack

Vite · React 19 · TailwindCSS · React Router · TanStack Query · Zustand · deployed to Vercel.
Chosen deliberately to match `C:\WorldCupDashboard` so that familiar ground stays familiar and the
new learning is in the domain, not the tooling. JavaScript, not TypeScript.

### 4.2 Serverless proxy and edge cache

All upstream traffic passes through the app's own Vercel functions — `/api/espn/*` and
`/api/bbc/*` — never directly from the browser. This avoids CORS entirely, keeps users invisible to
the upstreams, and most importantly places **Vercel's edge cache in front of every request**.

The edge cache is the cost control. Upstream call volume is governed by TTL, not by usage: any
number of open clients still costs one upstream request per TTL window.

| Route class | `s-maxage` | `stale-while-revalidate` |
|---|---|---|
| Season fixtures | 1 hour | 7 days |
| League tables | 10 minutes | 1 day |
| Squads / team detail | 1 day | 7 days |
| Today's scoreboard | 30 seconds | 5 minutes |
| Live match detail | 30 seconds | 2 minutes |

**Last-known-good fallback:** each proxy route retains its most recent successful response. If the
upstream fails or returns an error body, the stale copy is served with a freshness timestamp and
the UI shows a quiet "as of HH:MM" note. An upstream outage degrades the app to slightly stale
rather than breaking it.

**Live polling** runs only while the tab is visible *and* a match is actually in progress, and
stops when the last match finishes.

### 4.3 Source adapters

`src/data/espn.js` and `src/data/bbc.js` are adapters whose sole responsibility is translating
provider JSON into the shared domain model. No component, hook or store above this layer knows
which provider any given fixture came from.

This boundary earns its keep three ways: League One and Two behave identically to every other
competition despite a different provider; an upstream shape change touches exactly one file; and
migrating to a paid provider later would be a single-file change.

### 4.4 Derived data

Computed locally rather than fetched — fewer requests, fewer dependencies, and the most
interesting state work in the project:

- League One and Two tables, from results.
- Form guides (last five) for every club in every competition.
- Survival state for knockout competitions — who remains, who is out, and in which round they fell.
- Draw detection, by diffing published ties against the record of ties already shown.

### 4.5 Persistence

`localStorage` only:

- `followedClubs` — array of club identifiers.
- `seenTies` — identifiers of every knockout tie already revealed, so a draw is never re-announced.

No database, no backend state, no accounts.

---

## 5. Domain model

```
Competition  id, name, country, tier, type: 'league' | 'cup', source: 'espn' | 'bbc'
Team         id, name, shortName, crestUrl | null, monogram, colour, competitionIds[]
Fixture      id, competitionId, kickoff, status, round?, home: Side, away: Side, venue
Side         teamId, score, penaltyScore?
TableRow     teamId, position, played, won, drawn, lost, goalsFor, goalsAgainst,
             goalDifference, points, deduction, form[], zone
Player       id, name, position, shirtNumber, nationality, age
MatchDetail  fixtureId, events[], lineups, teamStats | null
KnockoutTie  id, competitionId, round, home, away, seenAt | null
```

`Team.monogram` is always populated; `crestUrl` may be null. Rendering always prefers the crest and
falls back to the monogram, so crestless clubs are a normal case rather than an error state.

---

## 6. Design system — "Broadsheet"

The visual language of a quality newspaper's sports pages. Space comes from typographic rhythm and
hairline rules, not from boxes and shadows.

| Token | Value |
|---|---|
| Ground | `#FBF9F5` paper cream |
| Ink | `#17140F` |
| Accent | `#A11B1B` editorial red |
| Rule | `#E5DFD3`, hairline (1px) |
| Muted | `#8A8175` |
| Drawer fill | `#F4F0E7` |
| Display / body | Georgia, Iowan Old Style, Times New Roman, serif |
| Labels / metadata | system-ui, uppercase, letter-spaced |
| Numerals | lining, tabular |

Principles, applied everywhere:

1. **Nothing is squashed.** If a screen cannot breathe, remove data from it rather than shrink it.
2. **Colour is information.** The accent red marks live state, your clubs, and section headings —
   nothing decorative.
3. **Qualification zones are 2px margin ticks**, never coloured row backgrounds. Coloured rows are
   what make other apps' tables look like spreadsheets.
4. **Club colour appears sparingly**, sourced from the feed, never as a large fill.
5. **Empty cases are designed, not blank.** Where League Two lacks statistics, the screen says so
   in one quiet line instead of rendering empty bars.

---

## 7. Screens

### 7.1 Navigation

Three tabs: **Today**, **Competitions**, **Clubs**. Matches and team pages open over the tab bar
from wherever they are tapped, so every crest in the app is a live link to the same team page.

### 7.2 Today — home

Live matches first, followed clubs pinned above everything else, then the rest of today, then
yesterday's results. Draw invitations appear here as cards. Sections are `★ Your clubs` and
`Also today`; favourites prioritise, they never hide the rest of the football.

### 7.3 League

Table, Fixtures and Results.

The table is **four permanent columns** — position, crest, club, points — with generous row height.
Tapping a row opens it in place with played, W/D/L, goals for and against, and the form guide as
five glyphs. Specifics:

- **The split** is drawn as a labelled rule between 6th and 7th in the Premiership, treated as a
  real event in the table rather than a footnote.
- **Qualification zones** as coloured margin ticks with a legend.
- **Points deductions** shown explicitly; the feed provides them.
- The **European league phases** — Champions, Europa and Conference — are 36-row variants of the
  same table.

### 7.4 Cup

Three zoom levels on one horizontal swipe:

1. **Survival board** — remaining clubs large and in colour; eliminated clubs small, greyed, and
   grouped by the round that removed them. The board visibly thins as the competition progresses.
2. **Bracket** — a real bracket flowing top to bottom rather than left to right, so it needs no
   horizontal scrolling or zooming. Losers grey out in place; penalty shootouts are named.
3. **Your path** — when a followed club is involved, its route through the competition as a
   vertical spine: opponent, score, venue, and how each tie was survived.

### 7.5 Team

Next and last match, full season fixtures, squad, form. Squad is omitted with an explanatory line
for League One and Two. *(Layout to be designed at build time, applying §6.)*

### 7.6 Match room

Score and clock, then a vertical timeline of moments — goals, cards, substitutions — newest first,
one moment per row. Team statistics below. Degrades to a clean scoreline plus scorers where the
source provides no detail.

### 7.7 Settings

Manage followed clubs and competition visibility.

---

## 8. The draw ceremony

The signature feature. Three rules govern it: **it never ambushes you, it never autoplays, and it
is always replayable.**

### 8.1 Detection

The app records every tie it has shown (`seenTies`). When the feed publishes ties for a round
containing ties not yet seen, a draw has occurred. No manual scheduling, no scraping of broadcasts.
Verified feasible: 23 Carabao Cup second-round ties were sitting in the feed as `STATUS_SCHEDULED`
at the time of writing.

### 8.2 Invitation

A card appears on Today — *"The Scottish Cup quarter-final draw is in — 4 ties. Reveal?"* — and the
ties stay hidden until it is accepted. Once revealed, the ties are marked seen permanently, and the
ceremony remains replayable from the cup page.

### 8.3 Pacing — tap to draw

**Nothing advances on a timer.** Each tap draws the next ball or tie; between taps the app waits
indefinitely, so a draw can be abandoned halfway through and resumed later. A "Reveal the rest"
control finishes immediately for when the tie you cared about has already come out.

### 8.4 The hat, by round size

The pool of remaining clubs is always visible, and always empties as clubs are drawn — this is what
creates the anticipation. Its medium changes with scale:

**Small rounds (≤ 16 clubs) — "the bowl".** A tinted, soft-cornered vessel holding
jumbled, slightly tilted badges. One ball per tap: the ball tumbles, holds, opens to reveal the
club, the badge **pulses in the bowl at the same instant**, then leaves, and the survivors close the
gap. That simultaneous pulse is what binds the two halves of the screen together. Any club in the
bowl without a crest shows its monogram disc (§8.5), so the bowl never depends on crest coverage.

**Large rounds (> 16 clubs, most without crests) — "the roll call".** The hat becomes a column of
names set as a newspaper would set them. The box scrolls itself to the club being drawn, lights it
red, then strikes it through. One **tie** per tap, since at that scale the tie is the unit of
interest. Sixty names occupy less space than sixteen badges and need no crests at all.

Worst realistic cases, verified: FA Cup first round 78 clubs, Scottish Cup first round 60.

### 8.5 Monograms

Crestless clubs render as a serif monogram disc — **AT** Auchinleck Talbot, **BO** Banks O'Dee,
**WA** Wick Academy. Used consistently across fixtures, tables, brackets and team pages, not only
in the draw.

---

## 9. Release scope

Driven by the calendar: the Scottish Cup and FA Cup's significant rounds fall in January, European
knockouts in February, but league football is happening now.

### Release 1 — the daily app

- Today screen
- All 13 competitions, full-season fixtures and results
- League tables for all eight table-bearing competitions — the five domestic leagues plus the three
  36-team European league phases — with League One and Two computed from results
- Team pages with squads where available
- Match room
- Follow / unfollow with favourites prioritisation
- Broadsheet design system and the monogram system
- Proxy, edge caching, adapters, last-known-good fallback

### Release 2 — the cups *(built through autumn, complete before January)*

- Survival board, bracket, your path
- Draw detection and invitation
- The tap-to-draw ceremony, both bowl and roll call

### Deferred

Player detail pages, head-to-head, historical seasons, advanced statistics, tier 3–4 match detail
via football-data.co.uk.

---

## 10. Testing

Vitest with Testing Library, following the existing World Cup dashboard setup.

Priority areas, in order:

1. **Adapters** — fixed JSON captures from both providers, asserting correct translation to the
   domain model. Must include a crestless club, a postponed fixture, a penalty shootout, and an
   ESPN error-body-with-HTTP-200 response.
2. **Derived data** — computed League One/Two tables against known real results; form guides;
   survival state; the split boundary; points deductions.
3. **Draw detection** — that a new round produces exactly one invitation, that seen ties never
   re-announce, and that an interrupted draw resumes correctly.
4. **Empty and degraded cases** — that a League Two match room renders its explanatory line rather
   than empty statistics, and that last-known-good data surfaces its timestamp.

---

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| ESPN changes response shape | Moderate over time | Adapter boundary; captured fixtures fail loudly in tests |
| ESPN or BBC blocks the proxy | Low | Correct User-Agent behaviour (§3.5), polite TTLs; BBC covers some ESPN ground as partial fallback |
| ESPN drops more competitions, as it did with tiers 3–4 | Moderate | BBC adapter already exists and covers all Scottish football |
| Draw detection misfires on a data correction | Moderate | Ties keyed by identity, not position; seen-set is additive; reveal is idempotent |
| Scope creep across 13 competitions | High | Release split; deferred list is explicit |

---

## 12. Deployment

GitHub repository, deployed to Vercel. No environment variables or secrets are required — a
consequence of every source being public and keyless. `.superpowers/` is git-ignored.

---

## 13. Post-release additions (agreed 2026-08-14, after first live use)

Four changes requested after Release 1 shipped. Items 13.1–13.3 form **Release 1.1**;
item 13.4 amends the Release 2 cup page.

### 13.1 Today screen enrichment

- **Yesterday's results** — already present (§7.2); the launch day happened to be a quiet
  Thursday, so the section had nothing to show. Kept, unchanged.
- **"Next up" for followed clubs** — every followed club with no fixture today gets a row
  under ★ Your clubs showing its next fixture with date and kickoff. Derived from the
  season-fixture caches; no new requests.
- **Mini league tables** — compact quick-views of the Scottish Premiership and the English
  Premier League (top rows + any followed club's row, four columns of the T1 design) with
  the whole widget linking to the full competition page.

### 13.2 Universal club navigation rule

A club's crest or name is always a link to its team page, **except** where another
interaction takes precedence — the league-table row (tap = expand drawer; the drawer
carries the team-page link) is the canonical exception. In fixture rows the crest is the
team link and the rest of the row remains the match link. Applies to every current and
future screen, including the match room header and the Release 2 cup widgets.

### 13.3 TV broadcast metadata

**Requirement:** fixtures carry UK broadcaster info (Sky Sports, TNT Sports, BBC, ITV,
Amazon Prime Video, Premier Sports) wherever fixtures render. *(Premier Sports added
2026-08-14 — it holds live SPFL rights and was missing from the original list.)*

**Feasibility (probed live 2026-08-14):** ESPN's `broadcasts`/`geoBroadcasts` carry US
broadcasters only (NBC, Peacock, USA Net); `?region=gb` is ignored; Scottish fixtures carry
none. The BBC feed has no broadcast fields. TheSportsDB's TV endpoint exists but its free
tier is truncated to near-uselessness; its paid tier (~$9/mo) claims full listings but
cannot be verified before subscribing. There is **no free, reliable API for UK football TV
listings.**

**Design consequence:** the domain model gains `Fixture.tv: string[]` (canonical channel
names) filled by a **swappable tv-provider adapter**, and a `TvBadge` renders wherever a
fixture does — fixture rows (compact), match room (full). The provider behind it is a
data-source decision recorded when made:

| Option | Cost | Trade-off |
|---|---|---|
| **Curated JSON file in the repo** (chosen 2026-08-14) | £0 | Accurate but manual — someone must update it from broadcaster announcements |
| TheSportsDB Premium | ~$9/mo | Automatic; UK coverage unverifiable until subscribed |
| Scraping a listings site | £0 | Fragile, and against most sites' terms — rejected |

Whichever provider is chosen, missing TV data renders as nothing — never a placeholder.

### 13.4 Release 2 amendment — "the field" widget

Cup pages gain a **competing-teams widget**: every entrant's crest (monogram fallback),
each linking to the team page per §13.2. Grouped meaningfully per competition type:

- **European competitions, pre-league-phase:** *Qualified* vs *Still qualifying* —
  derivable from round slugs (qualifying-round fixtures vs league-phase membership).
- **Domestic cups:** grouped by entry round (the round structure is in the feed).

This widget and the Release 2 survival board (§8) are siblings: the field before the
competition starts, the survival board once it is underway. They can share layout DNA.

### 13.5 Calendar (agreed 2026-08-14)

A month-grid calendar becomes the app's **fourth tab** (Today · Calendar · Competitions ·
Clubs). One component, two modes:

- **General** (`/calendar`) — fixtures from every non-hidden competition. Day cells show up
  to three crests (fixtures involving followed clubs first, shown by the followed club's
  crest; otherwise the home crest) plus a `+n` overflow. Tapping a day selects it and lists
  every fixture on that date beneath the grid as standard fixture rows (match links, TV
  badges, the club-link rule — all inherited).
- **Club** (`/calendar/:teamId`) — the same grid filtered to one club; each playing day
  shows the **opponent's** crest. Reached from calendar chips in Today's ★ Your clubs
  section: one chip per followed club (crest + calendar glyph).

Broadsheet treatment: serif month title with ‹ › paging, sans letter-spaced weekday
initials, hairline grid rules, tabular date numerals, today outlined in accent. Weeks start
Monday. Days are keyed by the device's local date, consistent with Today's partitioning.

### 13.6 What's on TV (agreed 2026-08-14)

Today gains an **On TV** section: upcoming televised fixtures (curated TV data, §13.3)
within the next 14 days, soonest first, capped at 8, grouped by day. Renders nothing when
no televised fixtures are known — never a placeholder. Placed between Earlier today and
Quick view.


### 13.7 Dual-source cup fixtures (agreed 2026-08-14)

**Trigger:** ESPN's Scottish League Cup feed carries only the 80 group-stage fixtures —
the knockout rounds (where Celtic and other seeded clubs enter) are absent even the day
before they kick off. The BBC's `scottish-league-cup` tournament carries them.

**Mechanism (generic, per-competition):** a competition may declare
`bbcTournament: '<slug>'`. Its fixture queries then fetch both sources and merge:

- ESPN fixtures are authoritative; a BBC fixture is added only when no ESPN fixture exists
  for the same date + home + away (normalized names). If ESPN later publishes the round,
  its fixture wins and the BBC copy disappears.
- Merged BBC fixtures are **re-identified onto ESPN teams** by normalized name against the
  ESPN team lists for the top two Scottish tiers (edge-cached requests) — so followed-club
  matching (★, Next up, club calendars) and crests work. Clubs with no ESPN identity keep
  their BBC identity and monogram.
- Merged fixtures carry a `bbc-` prefixed id; their match rooms degrade to the scoreline
  (no ESPN summary exists).

Applied now to `sco.cis`; the BBC proxy allowlist also admits `scottish-cup` so the same
flag can be flipped for `sco.tennents` if ESPN's feed goes similarly quiet in January.

### 13.8 The rich match page (agreed 2026-08-14)

The match room grows into the app's centrepiece, using summary-endpoint data verified live:

- **Timeline with names.** ESPN carries event participants in `participants[]` (not the
  `athletesInvolved` field the adapter previously read — the cause of bare "Goal" rows).
  Goals name the scorer; substitutions carry both players (on/off); cards name the player.
  Rendering stays one moment per row: minute, name(s), quiet type word, team crest.
- **Date line + kicker.** Full date always; cup round in the kicker where present.
- **Metadata line:** venue with city · attendance · referee, one quiet sans line.
- **Form coming in:** five W/D/L glyphs per team (feed's `lastFiveGames`); renders
  pre-match too.
- **Head-to-head:** the feed's series summary plus its last meetings with scores;
  renders pre-match too.
- **Standouts:** post-match only — top performers per side (shots, saves, passes leaders).

### 13.9 Contextual match videos (agreed 2026-08-14)

Finished fixtures offer one YouTube video card: a deterministic search
("{home} vs {away} highlights {date}") via the YouTube Data v3 API, showing the top
result as an embedded player; an ✕ dismisses it and the next suggestion takes its place;
after the last suggestion the card disappears. No AI query generation — the query is
derived from fixture data.

**Key exception (amends §12):** this is the app's one API key — `VITE_YOUTUBE_API_KEY`,
client-side by necessity, HTTP-referrer-locked to the deployment domain in Google Cloud
Console, free quota (search costs 100 units of the 10,000/day). Reused from the World Cup
dashboard's key. The app degrades gracefully without it: no key → no video section, no
placeholder, everything else unaffected.

### 13.10 The field — cup overview (agreed 2026-08-14; first slice of Release 2 §8)

Cup competition pages gain an **Overview** tab (their default), carrying — graphical means
favoured throughout:

1. **Structure strip.** A horizontal Broadsheet flow describing the competition's shape:
   stage nodes (count numeral + small label) joined by hairline separators — e.g.
   `36 league phase › top 8 to last 16 › 9–24 play-off › knockout`. Wording per competition
   is registry config (`structure`); knockout entry waves are annotated with counts derived
   from the fixture data, never hardcoded.
2. **The field.** Every club that appears in the competition's fixtures:
   - **Still in** — large colour crests (monogram fallback) in a grid, grouped by **entry
     tier** where entries stagger (tier = the round of a club's first fixture, labelled with
     the prettified round name); single grid when everyone enters together.
   - **Out** — small, greyed crests grouped by the round in which they fell (the K1
     survival-board design validated in the original brainstorm).
   - Every crest links to the team page (§13.2).
3. **Survival logic** (pure, generic): rounds ordered by earliest kickoff; a club is OUT
   when a completed round it appeared in is followed by published later-round fixtures it is
   absent from — this single rule handles knockouts, group stages (absence from the knockout
   = eliminated) and two-legged rounds. Refinement for single-leg comps (Scottish/English
   cups): a decided completed tie (score or penalty shootout) eliminates its loser
   immediately, without waiting for the next draw. Undecidable ties leave both clubs in.
4. **European pre-draw state:** ESPN carries no qualifying-round data — before the league
   phase is drawn the field shows the structure strip plus one honest line ("The league
   phase draw hasn't been made yet"). Qualifying-team lists are out of scope until a source
   exists.

### 13.11 European qualifying (agreed 2026-08-15)

ESPN publishes qualifying rounds as separate competitions (`uefa.champions_qual`,
`uefa.europa_qual`, `uefa.europa.conf_qual`) — the main codes stay empty until the league
phase is drawn, which is why the European pages looked dead mid-August. Each European
competition declares `espnQualifier: '<code>'`; its fixture queries fetch both codes and
concatenate (same id namespace — no re-identification needed; dedupe by event id, sort by
kickoff). Qualifying round slugs join the round prettifier. Consequences: the Overview
field shows qualifying clubs tiered by round; Today windows carry European qualifiers;
§13.4's "qualified vs still qualifying" grouping becomes derived data. The structure strip
also becomes horizontally scrollable (no wrapping — an orphaned separator wrapped badly on
mobile).

### 13.12 Context everywhere (agreed 2026-08-15)

Three rules, applied app-wide:

1. **Fixture rows name their competition.** A small sans context line (competition short
   name, plus the prettified round where one exists) sits above the teams in every fixture
   row on mixed-competition surfaces — Today (all sections), On TV, calendar day lists,
   Next up. It navigates to the competition page. Competition pages themselves suppress it
   (the context is the page).
2. **The match-room kicker links back.** The competition name in the kicker navigates to
   the competition page.
3. **Every match shows its siblings.** A muted section at the bottom of the match room —
   "In this round" for fixtures with a round, "That day" for league fixtures — lists the
   other fixtures of the same competition in the same round (or on the same local date),
   as standard fixture rows without the context line. Capped at 8, absent when empty.

### 13.13 Scroll restoration (agreed 2026-08-15)

Navigating to a different route scrolls to the top; within-page interactions (tabs,
drawers, calendar day selection) never do. Implemented as a pathname-keyed effect.

### 13.14 The draw, scoped for build (agreed 2026-08-15; implements §8)

- **Seen-tie state** joins the prefs store (`seenTies`, additive, persisted). **First-run
  seeding:** when the key is absent, every currently-published tie is marked seen — draws
  only announce from installation forward. Detection: a cup round whose fixtures are all
  scheduled, all unseen, and round-labelled is an unrevealed draw.
- **Hiding is Today-scoped.** While a draw is unrevealed, its fixtures are withheld from
  Today's sections and replaced by the invitation card. They appear normally everywhere
  else (calendar, fixtures tabs) — the app can't spoiler-proof itself and §7.2's
  "prioritise, never hide" outranks theatre outside Today.
- **Ceremony** at `/draw/:compId/:round`: bowl mode (≤16 clubs — crests in the vessel, one
  ball per tap: tumble → hold → reveal → pulse in bowl → leave → land in the tie list) or
  roll-call mode (>16 — the column of names, one tie per tap, both names light then
  strike). "Reveal the rest" completes instantly. Completing (either way) marks the round's
  ties seen. Replayable afterwards from the cup Overview ("Replay the draw") — replays
  never re-hide. CSS animations, tap-paced, nothing autoplays (§8.3).

### 13.15 League-phase draws (agreed 2026-08-16)

Phase rounds (`league-phase`, `group-stage`) are excluded from tie-draw detection (§13.14)
because a 144-fixture ceremony is meaningless. Instead they get a **club-centric** ceremony:

- **Detection:** for each FOLLOWED club, a phase round in one of its competitions whose
  fixtures for that club are all scheduled, all unseen, and ≥2 → an invitation on Today:
  crest + "{CLUB}'S DRAW IS IN — {roundLabel} · {n} opponents". The club's unrevealed phase
  fixtures are Today-hidden like tie draws.
- **Ceremony** at `/draw/:compId/:round/:teamId`: bowl of the opponents' crests; one
  opponent per tap (tumble → reveal crest + name + home/away marker → pulse → leave →
  land); landed list = the campaign in kickoff order, each row `v {Opponent} (H|A)`.
  Completion marks that club's phase tieIds seen. Replayable; browsable for ANY club via a
  quiet "Replay the {roundLabel} draw" link on its team page when it has phase fixtures.
- Engine gains an `opponents` mode (one fixture per reveal unit, subject club's opposite
  side revealed); pool shuffle, tap pacing, seen-marking semantics all inherited.

### 13.16 Player pages (agreed 2026-08-16; un-defers §2's player detail)

- **No portraits.** The feeds serve no player photos (verified: SPFL and EPL headshots 404).
  No placeholder circles or initial roundels anywhere — player identity is typographic:
  name, shirt number, position.
- **The Splits design** (user-selected from mockups): bio line (nationality · age · height ·
  games); position-aware stat sections rendered as two-tone proportion blocks — attacking
  (shots on/off target, passes on/astray with the count-forward), discipline (fouls, cards,
  tackles won); keepers swap attacking for saves / clean sheets / conceded. Data from the
  core-API athlete + season-statistics endpoints (proxied; the proxy allowlist grows two
  core-API shapes).
- **Access:** full page at `/player/:compId/:playerId` from squad lists; from match
  contexts (standouts, lineups, timeline names) a **bottom sheet** peek — name, club ·
  position line, three headline numbers (position-aware), `Full profile →`. Drag-bar + ✕
  dismiss; match context never lost. Every player name app-wide becomes tappable (§13.2
  extended to people).
- **Table movement** ships alongside: `rankChange` from the standings feed renders as a
  small ▲/▼ beside moved clubs (zone-legend green/red), nothing for unmoved.

## 13.17 The sentence (supersedes the structure strip, §13.10.1)

The competition overview's structure display is a couple of hand-written sentences of broadsheet prose
(`comp.blurb`) under the tab bar — serif, max 60ch, hairline beneath — replacing the horizontal
structure strip, which is retired (component deleted). Blurbs are editorial, curated per season
like the TV listings. The field board's two section headers ("Still in", "Out") carry their counts
as right-aligned serif numerals on the same rule (GateRule, local to FieldBoard). User verdict
2026-08-16: "the sentence one… suits the broadsheet brand."

## 13.18 Gold polish (v1.0.0)

1. **Full-bleed club watermark** — the team-page crest watermark anchors to the VIEWPORT
   (fixed, top-right, same -140px offsets and opacity), not the padded content column, so it
   bleeds to the actual screen edge. Content stacks above it; no horizontal overflow.
2. **Shirts in the match-room lineups** — each lineup row leads with the club-coloured Shirt
   (22px, shirt number on the chest) instead of the bare numeral column. Colour comes from the
   fixture side; unknown colour falls back to the drawer tone (Shirt's built-in guard). Full
   two-team formation graphics were assessed and declined: away/European squads routinely lack
   position data, so the pitch would degrade more often than it delighted.
3. **The sheet opens all the way** — the player bottom sheet's grab handle is functional: swipe
   up (or tap it, or tap "Full profile") expands the sheet in place to the full Splits profile,
   scrollable, underlying page still behind it; swipe down collapses to the peek, again to
   dismiss. "Open as page →" inside the expanded view keeps the deep link. The sheet also says
   what it's doing when data is slow ("Loading player…") or missing ("Player information
   unavailable."). Reduced motion honoured throughout.
4. **The gold sweep** — backlog minors closed: quiet-day line ordering, pre-season mini-table
   guard, empty European squads say "unavailable", useSquad distinguishes outage from empty,
   single-pairing two-leg invitation gate, calendar month-paging selection reset, On TV starts
   tomorrow (no duplicate of today's rows), sibling fixtures show ★, live-minute tabular-nums,
   height in primes, pass-share clamp, memo/tidy items.

## 13.19 The morning edition (v1.1)

1. **The fixture drawer** — tapping a fixture row unfolds an inline drawer beneath it (the
   LeagueTable Drawer pattern), instead of navigating. A RESULT's drawer: goalscorers by side,
   attendance, "Full detail ->" link to the match page. An UPCOMING fixture's drawer: recent
   head-to-head meetings, "Full detail ->". Detail is fetched ONLY when a drawer first opens
   (lazy useMatchDetail). LIVE (in-play/HT) rows keep direct navigation to the match room — when
   the ball is rolling you want the room, not a drawer. BBC comps (no match detail) keep direct
   navigation too. Drawer degrades in one line ("Match detail unavailable.").
2. **The papers** — a news section on Today, after Earlier today and before On TV: label "The
   papers", two sub-blocks: Celtic and British football, each from the corresponding BBC Sport
   RSS feed via a new allowlisted proxy (api/news.js: exactly two feeds, 15-min edge cache,
   last-known-good). Each block opens with its TOP story (serif headline linking out to the
   article, two-line standfirst, "BBC Sport · Nh ago" meta, optional thumbnail); a quiet
   "+ 4 more" reveals the next four as compact headline rows, rendered (and their images
   loaded) only on reveal. Degraded: "The papers haven't arrived." Loading: "Fetching the
   papers…". External links open in a new tab.
3. **European TV listings** — the curated tvListings.json gains verified UK broadcast entries
   for upcoming UEFA fixtures (TNT Sports / Amazon Prime era). Verified-only rule unchanged:
   a fixture whose UK broadcaster can't be confirmed stays unlisted.

## 13.20 The scout (v1.2)

User use case: tap a European opponent (LASK Linz) from Today "with the intention of finding out
if they are a good team" — and find nothing. Fix, verified against the live feed and £0:

1. **Domestic-league discovery** — ESPN's team endpoint carries `defaultLeague` (slug + human
   name) even when fetched under a UEFA code, and useSquad's FIRST fallback leg already fetches
   exactly that endpoint. The discovered league joins the fallback chain, so any European
   opponent's roster resolves generically (LASK → aut.1 → 26 players) with no curated map and no
   extra requests for the discovery itself.
2. **The scout line** — on a team page whose squad resolved under a DISCOVERED foreign league
   (not the route comp, not a registry comp), a one-line scouting note above the squad: the
   domestic league's name and the club's record in it this season, derived from the same
   response ("Won 3 of 3 in the Austrian Bundesliga · 9 points"). Player sheets keep working via
   a minimal synthetic comp descriptor for the foreign league.
3. **The scout film** — the same team page offers a LAZY YouTube card ("The scout film"): nothing
   is searched until tapped (zero quota when unused); on tap, a search for recent highlights of
   the club plays inline with the match-room VideoCard's dismiss-to-next behaviour. Foreign
   (discovered-league) clubs only — you don't need a scouting film for Celtic.

## 13.21 The elegance (v1.3) — the motion system

User brief: the minimal look reads as a high-class product; the next tier of premium is HOW
things arrive. Observed defect: accordions open by loading first, then "jutting into place".
Everything that appears on screen now arrives through ONE motion language:

- **The house ease**: cubic-bezier(0.3, 0.9, 0.3, 1) (already the sheet's), everywhere. No
  bounce, no scale, no spring — a broadsheet page settles, it doesn't jiggle.
- **The rise**: elements enter with opacity 0→1 + translateY(6px)→0, 240ms. Screen sections
  stagger 40ms apart (cap 5). Animates on MOUNT only — a refetch re-render must never replay it.
- **The glide (accordions)**: a drawer opens IMMEDIATELY at tap — skeleton inside if data isn't
  there yet — and its height animates smoothly (measured, ResizeObserver-driven) both on open/
  close AND when arriving content changes the height. No jutting, ever.
- **The skeleton**: hairline-tone (#E5DFD3) placeholder bars — visibly darker than both the paper and the drawer surfaces they sit on in the shape of the coming content
  (2-3 hairline-height lines), gently pulsing opacity 0.55↔1, 1.6s. Replaced by a 160ms
  crossfade when content lands. Skeletons appear ONLY during genuine fetches — cached content
  renders instantly with no placeholder flash.
- **The sheet**: opens with the existing slide; peek↔expanded now animates measured heights
  (retiring the v1.0 parked finding that h-auto→88vh never interpolated); its content follows
  the same skeleton/crossfade rules.
- **Reduced motion**: every rule above collapses to instant state changes under
  prefers-reduced-motion — one global CSS guard, not per-component opt-ins.
- The draw ceremony's own choreography (§8.3-8.5) is UNTOUCHED — it is performance, not chrome.

## 13.22 The drawers, redrawn (v1.4)

User verdict on the interior mockups (2026-08-17): result drawer = "the match line" (R-A);
fixture drawer = "the ledger alone" (F-B) PLUS F-A's balance bar. Explicit constraint:
"make sure typography is consistent!" — every text style in the drawers reuses an EXISTING
recipe from the app's furniture, no new sizes/weights/trackings.

**Result drawer**: a full-width match line — hairline axis (ink), 0′/HT/90′ ticks (scale
stretches to 120′ with a 90′ tick when extra-time goals exist), goals as 9px club-coloured dots
(home above, away below, colour falls back to muted), minute labels in the muted 8px sans that
skip when they'd collide. Beneath: two scorer columns under club sub-labels (surname + minutes,
(pen)/(og) markers kept). Meta line: venue · attendance (whichever exist). Skeleton/error/Full
detail unchanged.

**Fixture drawer**: "Recent meetings" sub-label; each meeting an aligned row — fixed-width date
column (sans, tabular) then crest · score · crest as played, tabular serif. Beneath: the balance
bar — one 12px rounded bar, segments proportional to each side's wins in those meetings (this
fixture's home club's colour left, away right, draws in the rule tone between), captioned
"{Home} n · drawn n · {Away} n". Meta line: venue · date · kickoff. No form glyphs, no
positions (F-B chosen over F-A's extras). Empty meetings keep "No recent meetings." and show
no bar.

## 13.23 The match line, on the fixture page

User request (2026-08-17): reuse §13.22's goal-dot match line on the full fixture page. The
user considered the stats section and explicitly preferred it "right after the match meta on
the heading" — so it lives INSIDE `ScoreHeader`'s `<header>`, immediately after
`MetadataLine`, above the header's closing space. The graphic is rendered identically to the
drawer's — no size variant, no second recipe. Club-coloured dots already carry the Shirt.jsx
ink outline (§13.22, v1.4 M1), which is exactly what lets them survive the move from the
drawer tone `#F4F0E7` to paper `#FBF9F5`.

`MatchLine` is EXPORTED from `FixtureRow.jsx` rather than extracted to its own module: the
credit helper `creditedSide` — which carries the own-goal rule that a fix round once inverted —
is shared by the timeline AND the scorer columns, and splitting it across files invites a
divergent second copy. `timelinePoints` was already exported.

**Gate** — `showScore && Array.isArray(events)`. `showScore` is the heading's own existing
live-or-ft predicate (the one deciding score-vs-dash), so no new concept enters the file; the
array check is what keeps the degraded case honest, because `adaptSummary` always yields an
`events` array when detail exists and `detail` is null when it does not:

| Case | `events` | Renders |
|------|----------|---------|
| Live or FT with goals | `[…]` | axis + dots |
| FT, genuine 0-0 | `[]` | bare axis — the 0-0 IS the story (§13.22) |
| FT, source publishes no detail (BBC-merged) | `undefined` | nothing — never a phantom 0-0 |
| Scheduled / postponed | any | nothing |

The page therefore carries BOTH the graphic axis in its heading and the existing textual
`Timeline` below it — the glance and the detail. They are different components with different
names; no collision.

One existing test changed rather than being added to: the FT liveScore test's
`'.tabular-nums'` header selector now scopes to `[class*="text-[30px]"]`, because the match
line's tick labels are tabular too. That is the same scoping its sibling live-score test
already carried for StatusWord's tabular minute — intent preserved, over-matching removed.

## 13.24 The split rule (stats as tinted rules)

User request (2026-08-17), from the MatchPal reference "tho nowhere near as in your face.
classy. Subtle." Mockup round: S-A "the tinted rule" chosen over S-B (miniature balance) and
S-C (ink share). Addendum round: the drawer's balance bar stays as it is (B-KEEP) — its data
is three-way with draws, its 12px outlined weight is the drawer's focal instrument, and it was
validated in the v1.4 round. Player-page bars unconsidered candidates: one player, no
two-club split to colour. Coherence lives at the idiom level: INK BOUNDS CLUB COLOUR — the
outline at block scale, the split rule's tick at hairline scale.

**The treatment**: each scoring stat row's hairline becomes a 2px line on a 6px strip — home
colour from the left, away from the right, meeting at a 1px ink tick at the home share
(`statSplit`: null on 0-0 or unparseable, so those rows keep today's plain `border-rule/60`
hairline — no story, no split). Sides without a feed colour fall back to muted (the goal
dots' rule). The tick is the ink-boundary idiom where the Shirt outline cannot physically
fit: a white-kitted share reads as the bounded blank between tick and coloured edge. The
possession bar joins the family at its own 3px weight (8px strip), keeping its %-header row.

**The softening (same wave, SOFT-75 round)**: "broadsheet printed kind of softness" — every
CLUB-COLOUR FILL prints at 75% (`#RRGGBBbf`: split segments, possession, goal dots, balance
segments) and every INK BOUNDARY eases to 60% (`/60`: the tick, dot outlines, the balance
frame and dividers). Full black never borders a coloured shape anywhere. Deliberately
untouched: muted fallbacks (already the quiet tone), the match-line axis and every text/rule
ink (structure, not border), and Shirt/crest glyphs (icons at 11-18px need the full outline).
Tests pin the recipe: `rgba(r, g, b, 0.75)` fills, `bg-ink/60` / `border-ink/60` /
`divide-ink/60` boundaries.

Shutouts pin the tick to the edge (1-0 → 100). Verified live on Kilmarnock v Celtic: eight
split rules, two genuine 100% edges, the 0-0 red-cards row plain between coloured neighbours.
No live white-kit fixture existed to verify (EPL unstarted at build time) — that path is
pinned by unit tests and the approved mockup sheet.

## 13.25 The lineups take the field

User request (2026-08-17): lineups side by side, "have some fun with a subtle field in the
background. Nothing in your face." Mockup round: L-B "the centre circle alone" chosen over
L-A (full boundary — a new shape the app would have to carry) and L-C (plain columns).

**Layout**: two columns under one section label — HOME KEEPS THE LEFT, found by `homeAway`,
never by feed array order. All eleven starters always render (user law, stated verbatim:
an accordion "removes the point of the line up"); substitutes stay out as before. Names drop
to 13px, keep to ONE line and truncate with an ellipsis — the user chose truncation over
wrapping because every name remains tappable: the tap is how a clipped name reaches its full
player. Club sub-labels reuse the FieldBoard-family 10px sub-label recipe (ScorerColumn's is 9px) and truncate likewise. Shirts at 20.

**The field**: one mark — the half-way line running the gutter (1px, rule/65), opening into
the centre circle at mid-height (190px, rule at 65%, centre spot). Decoration sits BELOW
structure: 65% rule is deliberately softer than the section's true hairlines. aria-hidden,
pointer-events-none, drawn only when lineups exist. A circle never rides a stretched SVG
(ellipse distortion) — the line is a plain div, the circle a fixed-size svg.

Verified live on Hearts 4-0 Dundee United (the user's own reference match): home left,
11 v 11, circle behind the gutter, no name overflowing at 390px.

**Review-round hardening (same wave, 2026-08-17 final review — 8 finder angles, 14 confirmed)**:
the degraded-case and attribution laws now hold for every new graphic. `statSplit` treats
blank/junk strings as UNKNOWN (never Number('')→0); possession rides that same guard (no
fabricated 100%-away bar on 0-0/unparseable/missing feeds); `Stats` requires strict teamId
matches (the positional fallback died — club-coloured bars must never misattribute); Lineups
attributes by homeAway ONLY (an unattributed XI renders nothing, an unpublished side says
"XI not yet published." in one line), gates on STARTERS not roster presence, and keys rows by
player id. Geometry: SplitRule gained the old possession bar's bg-rule track (a pale-vs-pale
pairing still reads as a bar) and overflow-hidden (edge ticks clip, never overhang); the
lineups wrapper clips the 190px circle (short pre-match columns never bleed the arc over
neighbouring sections); the circle strokes currentColor under text-rule (token-true). The
press tone now lives in ONE exported helper — `pressFill` (FixtureRow.jsx) — used by the goal
dots, the balance bar and the split rules; it validates six-digit hex and falls back to muted
for any other shape, so a malformed feed colour can never paint invalid CSS while skipping
the fallback. Live-verified post-hardening: match page (8 splits, rule track, clipped circle,
11v11) and a result drawer (6 dots at press tone). The balance bar's press tone is pinned by
exact-value tests; no upcoming-with-meetings drawer was reachable in the live sweep tonight.

## 13.26 One head-to-head language

User request (2026-08-17, evening — with S-A live on their phone): every head-to-head surface
uses the fixture drawer's graphical setup, and the balance bar adopts the stats page's tinted
split-rule theme. This consciously REVERSES the morning's B-KEEP verdict — the user chose
B-JOIN with fresh eyes after seeing the split rules in production, which is a better-informed
decision than the mockup round's.

**The balance, re-drawn**: same name, testids and caption; the body becomes split-rule
geometry at the possession weight (3px line, 8px strip, overflow-hidden) — rule track,
home wins press-toned from the left, away wins from the right, draws as the EXPOSED TRACK
held between 60%-ink ticks at the two outcome boundaries. Equal boundaries (no draws)
collapse to one tick; edge boundaries clip like the stats page's shutout ticks. The v1.4
frame-and-dividers form is retired; its white-kit duty falls to track + ticks, as the
review round established for the split rules.

**The match page joins**: HeadToHead renders the drawer's own exported MeetingRow ledger
(crest · tabular score · crest) instead of prose, then the shared BalanceBar. Two depths,
deliberate: the drawer glances at the LAST THREE ("Recent meetings"); the match page is the
deep view — ALL meetings, sorted most-recent-first here (seasonseries order isn't trusted),
balance struck over everything shown. The feed's summary line stays.

Verified live on Rangers v St Mirren (the user's own reference match, hours after it
finished): 5 meetings sorted 16 Aug 26 → 26 Apr 25, ten crests, ticks at 60/100, press-tone
fill, rule track, no old frame anywhere. The drawer inherits the identical component, which
also retires the backlogged "balance-bar press tone by eye" debt — one component, seen once,
is seen everywhere.

## 13.27 The Fitba' Times (the nameplate)

The rebrand (2026-08-17, evening): the user named the paper — "The Financial Times Sport
Section... mixed with Celtic and or Scottish humour" — and the name is THE FITBA' TIMES,
because the abbreviation is FT. Their own goalmouth-FT logo, redrawn as token-true SVG.
Masthead round: M-B "the running head" chosen over M-A (front-page masthead, Today only)
and M-C (printer's mark).

**FitbaMark** (src/ui/FitbaMark.jsx): goal mark + wordmark, BOTH drawn as SVG — a LOGO, not
typography, so the closed type set gains no recipe. Colours ride the repo's currentColor
idiom (outer svg text-ink; the net's group text-rule) — a palette retune moves the mark with
every hairline. One accessible name ("Fitba' Times") on the wrapper; every svg beneath it
aria-hidden.

**Placement**: one quiet row in AppShell above the Outlet — mark at 19px, wordmark, hairline
border-rule beneath — so every screen carries the nameplate and no screen component changed.
Today keeps its h1 (M-B's whole point). Browser title → "Fitba' Times". No PWA manifest
exists, so the tab title is the entire rename surface.

Verified live on Today and a match page: mark + hairline present, title renamed.

**The home-screen icon (same evening)**: F-A "the goalmouth" chosen from three rendered
candidates (vs big-initials F-B and red-letters F-C, judged at true 60px home-screen size).
`public/apple-touch-icon.png` (exact 180x180, paper tile, mark centred — cut from the same
SVG via headless Chromium, not a hand export) plus `public/favicon.svg` (mark on its own
rounded paper tile so it holds on dark tab strips), linked from index.html. No unit tests —
binary asset + two link tags; verified by dist inspection and the prod content-type check.
Note: the vercel.json catch-all does NOT swallow these — static files outrank rewrites,
the same mechanism serving /assets/*.js.

## 13.28 Scorers in the lineups' row form

User request (2026-08-17, last of the night): the result drawer's scorer columns match the
lineups' line design, "clickable if ui/ux and data allow".

**The rows**: each scorer line becomes the lineups' row — Shirt at 20 in the COLUMN club's
colour carrying the scorer's REAL number, full name on one truncating line (surname retires),
the minutes fragment (primes, markers) held whole at the end via shrink-0. Numbers come from
the drawer's own summary payload: `shirtLookup` maps every roster entry (subs included — a
sub can score; BOTH sides — an own-goal scorer plays for the other club, their number is
real, the (og) marker carries the story) by playerId with name fallback. No match → null →
Shirt's own em-dash convention, never a wrong number.

**Clickable — deliberately deferred, not fudged**: the data allows it but PlayerSheet mounts
only in MatchRoom; drawers live on screens with no sheet host. Tappable scorers need one
app-level sheet ("the everywhere sheet") — added to the unbuilt shortlist as its own wave.
These rows are already shaped for it.

Verified live on Dundee Utd 1-1 Rangers (a sibling drawer): #15 Rose and #11 Aasgaard in
their clubs' shirts, numbers from the rosters. The same frame incidentally provided the
first drawer-surface eyeball of the §13.26 balance rule.

## 13.29 Two-legged ties (a won leg is not a won tie)

User report (2026-08-20): Rangers won a leg 1-0 and the app let it read as a good night —
the tie was lost on aggregate. The deepest law applies: THE APP MUST NEVER MISLEAD. The user
asked for the aggregate, the qualifier named, and the other leg one click away.

**The feed does the hard part** (live-probed on the UEFA qualifier codes): scoreboard events
carry `competitions[0].leg` ({value, displayValue}), a `series` block (completed +
per-competitor winner flags) and — decisive — `competitors[].aggregateScore`. Nothing is
computed that the feed already states; the adapter passes through `leg`, per-side `agg`,
`tieCompleted` and `tieWinnerId` (winner only surfaced once completed), all null on ordinary
fixtures so no other surface moves.

**domain/legs.js**: `tieLine(fixture)` — the verdict oriented like penaltyResult (null
unless leg + decided + winner-is-a-side + both aggregates published; `level` marks an
all-square aggregate whose winner came by ET/pens — the pens line tells that half).
`otherLeg(fixture, fixtures)` — the twin found by the draw ceremonies' own exported
`pairKey` (venue-reversal-proof, round-scoped). `legLabel` — '1st leg'/'2nd leg'.

**Three surfaces**: (1) the row's context line gains "· 2nd leg" — the smallest honest flag
at the point of misreading; (2) the result drawer prints the verdict in the shootout line's
accent recipe ("Levski through 2–0 on aggregate"), even and especially against the leg's own
score; (3) the match heading carries the same verdict beside the pens line, and the OTHER
LEG as a linked meeting-ledger-form line (label · crest score crest) navigating to that
leg's page — symmetric from either leg. The other-leg link lives on the page, not the
drawer (threading season fixtures into every FixtureRow host was the wrong trade; Full
detail is one tap).

Verified live on Kairat 0-1 Levski (Q3, decided): verdict correct against the leg score,
1st-leg link navigates, the reverse link navigates back. Celtic v LASK decides 2026-08-26 —
the first tie this feature will report in anger.

**Same-day follow-ups (user, 2026-08-20)**: the leg also reads on Next up ("Champions
League · 2nd leg · Tue 25 Aug") and in the match page kicker ("UEFA Champions League ·
Third round · 2nd leg") — both via legLabel in the existing context recipes. And the
other-leg link renders for PLAYED legs only: a scheduled return leg carries ESPN's phantom
score:"0" on both sides, so "2nd leg 0–0" read as a finished goalless game (user caught it
live on the LASK first-leg page). A first-leg page therefore links forward only once the
tie is done; a second-leg page always links back. Verified live on Today (Celtic's next-up)
and the Kairat–Levski pages.

## 13.30 League siblings, told by the day (§13.13 hardening)

User bug report (2026-08-20): a future league fixture's page (St Mirren v Celtic, 5 Sept)
showed the season's opening results under "In this round". Root cause: siblingFixtures and
the Siblings label tested RAW `fixture.round != null`, but a league fixture's round is never
null — it is the YEAR_PREFIXED season slug ('2026-27-scottish-premiership', live-probed)
that the entire season shares, so every league fixture matched the whole season and
slice(0,8) served the earliest games. The fix is one discriminator, applied at both sites:
`prettifyRound(fixture.round) != null` — the same YEAR_PREFIXED rejection the rest of the
app already lives by (the derivation's own comment stated this intent; the code didn't).

The user's ideal — grouping by MATCHDAY NUMBER — is not feed-available (`week: null` on
league events, live-probed), so same-local-day stays the honest grouping and the "That day"
label says exactly what it shows. Inferring matchday numbers from fixture sequence is
possible but fragile (postponements reorder everything); backlogged, not faked.

Verified live on the user's exact repro: 5 Sept page shows that Saturday's card.

## 13.31 The Local Club (Bellshill Athletic, WoSFL)

User request (2026-08-21): follow Bellshill Athletic — fixtures, results, table — "in any
way possible", with a hard allergy to churn-maintenance. Feasibility spike proved the clean
path (see .superpowers/brainstorm/2026-08-21-bellshill-athletic.md): the WoSFL's official
site runs on LeagueRepublic, whose PUBLIC, KEYLESS, DOCUMENTED JSON API serves the whole
season. £0 law intact. Bellshill are in the FIRST DIVISION 2026-27 (promoted as Second
Division champions, 25W of 30).

**A third source, 'wosfl'**, beside 'espn' and 'bbc':
- `api/wosfl.js`: the espn.js proxy pattern verbatim — anchored allowlist over exactly four
  LeagueRepublic routes (fixtureGroupsForSeason, teams/standings/fixturesForFixtureGroup,
  all ids strictly numeric), edge cache + last-known-good, never cache an error body.
- `src/data/wosfl.js`: adapter to the standard Fixture shape. LR dialect: away is `road*`;
  kickoff from `fixtureDateInMilliseconds` (no timezone maths); status from the two status
  descs (played→ft, Postponed→postponed, else scheduled); `round: null` ALWAYS — a league,
  so siblings group by "That day" and no phantom rounds print. No crests in the feed →
  the Crest monogram fallback wears the club initials. hasMatchDetail:false → the honest
  degraded line already built. Table: hasTable 'computed' — the BBC computed-table path,
  zero standings adapter.
- Registry: `wosfl.first` (source 'wosfl', country Scotland, zones {1:'promo'} only — the
  champions go up; relegation mechanics at tier 8+ vary, so nothing is painted that isn't
  known). WOSFL ids beside SEASON: season 236635540, group 4781136/type 1, ONE annual bump
  exactly like SEASON itself. NO blurb: the registry's own invariant (leagues carry
  none — blurbs are cup-overview furniture) caught the draft entry carrying one.
- Clubs: the BBC derive-teams-from-fixtures path extends to wosfl comps, making Bellshill
  (teamID 147611871) followable — favourites law applies, starred beside Celtic.

**The verification gate, as run (2026-08-21)**: preview deployments turned out DISABLED for
the Vercel project (branch push produced no preview; backlogged to enable). The gate was
answered at datacenter-class instead: the LR API probed from cloud infrastructure served the
full First Division standings — the CloudFront wall is the website's alone. Final proof is
the first prod call after merge, which the architecture tolerates failing safely
(last-known-good, the honest degraded line, and a clean revert path).

## 13.32 The lower leagues, looked after

User observations (2026-08-22, the morning after following Bellshill): four fixes, one wave.

**Video gated by the registry**: `hasVideo: false` on wosfl.first and both BBC leagues —
YouTube resolves to nothing but noise for junior fixtures, so those pages never search at
all (useMatchVideos' enabled checks the flag via byId; quota saved, noise gone).

**The grift filter**: game-engine "highlights" farmed for views (FIFA/FC-2x/eFootball
footage uploaded minutes after full time — the user spotted the pattern live). One pure
`filterVideos` at the search seam drops items whose title OR channel matches the grift
vocabulary. A blocklist, honestly: a novel disguise can slip through, and a genuine
"gameplay analysis" tactics card is knowingly sacrificed — the cheap side of the trade.
The searchVideos map gained channelTitle; two exact shape pins migrated.

**Crests for the crestless** (src/data/crests.js): two mechanisms, both strict —
a wrong crest is worse than a monogram. (1) WoSFL: curated self-hosted badges
(public/crests/wosfl/{teamId}.png, the tvListings precedent). TheSportsDB covered only
2 of 16 First Division clubs (Threave Rovers, Bonnyton Thistle — the famous junior badges
live up in the Premier), so the MECHANISM is the deliverable: drop a PNG in, add its map
line, the paper wears it. Bellshill's own crest (147611871.png) is the user's to source.
(2) BBC League One/Two: ESPN quietly carries sco.3/sco.4 with real logos (10/10 and 6/10,
live-probed) — LEAGUE allowlist widened, one memoised teams fetch per session builds a
normalised-name index applied over BBC fixtures; a failed fetch degrades to monograms and
never breaks the fixtures beside it. ClubsScreen's derived teams carry crests through.
The BBC fan-out test scoped its assertions to /api/bbc calls (intentional migration).

**The degraded line breathes**: the bare no-detail <p> gained the section rhythm's mb-8 —
"That day" no longer lands on its shoulder (32px live-measured, was ~8).

Verified live: junior match page (no video card, gap restored), WoSFL page (both curated
badges), League One (7 ESPN crests on BBC fixtures).

## 13.33 The Full Table

User request (2026-08-22, late): all table data at once, no accordion — offered with an
apology the design didn't need. The accordion was a PHONE-WIDTH COMPROMISE, never a
philosophy: the broadsheet prints the full classified when asked.

**The toggle**: the team-page-link recipe, right-aligned above the rows ("Full table" /
"Compact table"), wired through a persisted pref (fullTable + toggleFullTable in mdf-prefs)
so the reader's standing choice survives. **The full print**: header row in the drawer's
8.5px uppercase recipe over fixed-width columns (P W D L w-5; GF GA w-6; GD w-7 — the minus
sign earns the width; Pts w-7 at 13px, it is the story); rows drop to 13px names, crest 18,
rank-change glyph rests (compact keeps it); drawers rest entirely (Collapse unmounted, rows
inert). GD PRINTS FOR THE FIRST TIME anywhere in the app. Compact mode is byte-identical to
before — its pins stand untouched.

The open design question (fit vs sideways scroll at 390px) was answered by MEASUREMENT, not
taste: scrollWidth ≤ clientWidth live at phone width — the full print fits, no scroll
container needed. Verified on the real Premiership table (Celtic 2 from 2; the split rule
and zone ticks intact in both modes).

## 13.34 The Competitions front

User request (2026-08-25, after three days of daily use): the Competitions tab as a front
page — full EPL and Premiership tables on the page, summaries of the active tournaments,
the list below. Mockup round: C-A "the two classifieds" chosen over C-B (tabbed one-at-a-
time, my recommendation) and C-C (top-4 snippets) — the user took the long scroll with
eyes open, consistent with their full-print instincts.

**The page**: h1, then the two headline classifieds (accent sub-label + "Full table →" to
the comp page; EVERY row in the quick-table recipe — pos · crest · name · ★ · pts at 13px;
each row navigating to its club per the v1.8.2 rule; MiniTable's pre-season guard); then
IN PLAY ELSEWHERE — one line per active tournament from `activeSummary` (live → "Live ·
{round}" in accent; else nearest round inside a fortnight → "{round} · {day}"; league slugs
day-only via prettifyRound's rejection; nothing upcoming → no line); then the country-
grouped list minus the two headliners. A summarised cup appears in the desk AND the list
by design — status line vs canonical index. ZERO new fetches: two useTable hooks plus the
season fixtures Today already keeps warm.

Verified live: both classifieds render in full with real matchday-3/matchday-2 data; the
desk wrote itself — Carabao Cup Second round tonight, Champions League play-off 2nd legs
(Celtic in Linz) tomorrow.

## 13.35 The standouts, re-set — and the scout's first tool

Two user asks (2026-08-25), one release.

**ST-D standouts**: the user MIXED two mockups — ST-B's value-led layout with ST-A's club
colour — and the composition is theirs: the number carries the cell (24px serif tabular,
the drawer-cell recipe), the club-coloured shirt carries the man (press tone, real number
via the scorer-row roster lookup), SURNAMES only, and breathing room above the name line
(mt-2 — the user tuned the padding by eye off the addendum mock). Grid per club, up to
three cells; names stay tappable under the §13.16 gate. Three legacy pins migrated from
the retired "Shots: Full Name 5" text format.

**Scout Player**: the scout film's per-player sibling. A quiet control on the player sheet
AND page (the muted link recipe, offered only when a key exists — junior surfaces never see
it); the tap flips a lazy usePlayerVideos (cached forever, never retried, grift-filtered at
the shared searchVideos seam) whose query quotes the name and anchors it to football
('"Cláudio Braga" football highlights' — the bio carries NO club name; the club-scoped
query and richer identity arrive with the full Dossier wave, and PlayerScreen's
location.state club is noted as an early source for it). The reel renders as VideoCards
with the earned dismiss behaviour and "The scout's reel is empty." when exhausted.

Test-harness lore hardened along the way: every screen that mounts PlayerSheet must stub
video.js beside queries.js (MatchRoom, TeamScreen — whose file had TWO competing video
mocks; consolidated to one). Live-verified: five ST-D cells with real shirt numbers on
Hearts 4-0 DUFC; the scout control present in the sheet. The reel itself cannot play on
localhost (the key is referrer-locked to prod BY CHOICE) — prod verification follows the
merge, per the standing pattern.

## 13.36 The highlights reel (MOTD and Sportscene on iPlayer)

The user's ask (2026-08-25, spiked then shaped): Match of the Day is part of how he watches
football — surface it. The spike (.superpowers/brainstorm/2026-08-25-motd-iplayer.md) proved
the BBC /programmes JSON service free, keyless and alive, that MOTD's long synopsis NAMES the
featured matches, and that iplayer episode deep-links work. Picks from the mockup sheet:
**H-A + R-A + R-B** — the listing on Today, and the link printed in the result drawer AND on
the full match page.

**The data spine.** `api/iplayer.js`, the wosfl proxy's pattern verbatim (dual-mode
extractRest, last-known-good, s-maxage=1800/swr 86400): upstream www.bbc.co.uk/programmes,
TWO route shapes — `/{brand}/episodes/last.json` for brand in {b007t9y1 MOTD, m002jryr
Sportscene: Premiership Highlights} and `/{pid}.json` episode detail (pid `[a-z0-9]{8}`,
the LEAGUE_ANY precedent). BBC 403s non-browser callers, so the proxy sends a browser UA —
the exact INVERSE of the ESPN rule; never let one proxy's UA discipline leak into the other.
Never cache a body that doesn't parse as JSON (BBC errors arrive as HTML with 200s possible).
vercel.json rewrite + vite api-shim mount ride along. Registry: `iplayer: { brand, show }`
on eng.1 and sco.1 only. £0 stands.

**The join, honest by tier.** An episode covers a fixture when the fixture is FT, in the
show's league, and kicked off on the episode's broadcast date (Europe/London — a 22:30
Saturday MOTD covers Saturday's games). Within a covered day, a fixture is FEATURED only
when the episode synopsis names BOTH clubs — generic-token-stripped word matching
("Newcastle United" → "newcastle"), with the derby guard: when two same-day clubs strip to
the same tokens (both Manchesters), only the full name matches. Featured copy: "Featured on
Match of the Day"; covered-not-featured (and ALL Sportscene — its synopses never name games):
"Highlights · Match of the Day". A result with no episode simply carries no line — absence
is not degradation here, because coverage was never promised; this is the one place the
one-line law does not bite.

**The surfaces.** (1) Today: "The highlights" section in the On TV row form (H-A) between
Earlier and The Papers, rise-in-5 — one row per FRESH episode (broadcast within 36h, not a
repeat): show name in serif 15px, context line (relative day · league) beneath, "iPlayer →"
in the accent caps recipe at the right margin. The notice IS the notification; it expires by
itself, no push, no badge. (2) The result drawer: one line after venue·attendance in the
tie-line's register (R-A). (3) The match page: the muted-link recipe under the header meta
(R-B). All three are external links (target _blank, rel noopener) — link out only, never
embed (DRM). If the feed dies the reel rests silently, last-known-good absorbing the
transition.

**Polish (same day, the user's eye):** the R-B match-page line trimmed to plain "Watch on
iPlayer →" — the tier copy lives in the drawer; up top the venue line already crowds the
width. The player sheet's "Full profile →" control retired: the anchor bar alone says a
flip-up awaits — one affordance, not two. Riding along, two things the user's screenshot
exposed: attendance 0 is "not reported", never a crowd of none (both meta lines now gate on
> 0), and the referee now carries a small pea-whistle mark (currentColor SVG, plain shapes)
in the match-page meta line.

## 13.37 The Scout's Dossier (a face and a paragraph)

The long-agreed wave, de-risked by the 2026-08-25 spike
(.superpowers/brainstorm/2026-08-25-player-pictures.md) and shaped by two user constraints:
portraits are WELCOME (the rescinded-law clarification of 2026-08-22 stands), and the data is
**100% remote, fetched when required — nothing stored, no update scripts, ever**. Squads stay
ESPN-live; the dossier enriches a player only at the moment they're opened. Pick: **D-B, the
profile column** — a proper plate on the left (3:4, hairline border, the printed-photo
weight), name, meta and bio setting beside it; the sheet takes the same treatment a size
down with the bio clamped until the sheet expands.

**The sources (all £0, keyless, live-probed).** One proxy, `api/dossier.js` (house pattern:
dual-mode extractRest, last-known-good, long edge cache — bios change rarely), fronting
three JSON upstreams by prefix: `/wiki/summary/{title}` and `/wiki/search?q=` (en.wikipedia
.org REST + api.php), `/fpl/index` (fantasy.premierleague.com bootstrap-static, TRIMMED in
the proxy to {code, names, team} — the raw payload is ~700KB), `/tsdb/{name}`
(thesportsdb.com public dev key '123', rate-limited: cache hard). IMAGES are never proxied —
Commons, resources.premierleague.com and TSDB's r2 CDN serve <img> directly.

**The law of this feature: never show an unverified identity.** A wrong face on the right
name is worse than no face. Identity resolution: direct title lookup; a `type:
"disambiguation"` response (detectable, probed) falls back to search
(`"{name} footballer {club}"`, top hit); and NOTHING renders unless the summary's extract
names the player's current club (normalised token match). The FPL face joins by name within
the matched team only; the TSDB face requires strTeam to match the club. Face fallback:
verified Wikipedia portrait → FPL headshot (eng.1) → TSDB cutout → none. Bio and portrait
degrade independently; with neither, the page prints exactly as today — identity by type
alone, no placeholder plate, no one-liner (the §13.36 absence precedent: enrichment was
never promised).

**The page carries a small photograph credit** (the muted 8.5px caps register): "Photograph ·
Wikimedia Commons" / "· Premier League" / "· TheSportsDB" per source — a broadsheet credits
its plates. The scout reel's query sharpens to `"{name}" {club} highlights` when the club is
known (§13.35's deferred item). The stale "no portrait" design note in PlayerScreen's header
comment is rewritten — it described a feed fact, never a law. Dossier content arrives on the
xfade, never a skeleton (enrichment, not structure).
