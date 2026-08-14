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
