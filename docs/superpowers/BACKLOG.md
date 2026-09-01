# Backlog — deferred observations

Non-blocking items recorded at the Release 1.1 final review (2026-08-14).
None block usage; candidates for a future 1.2 pass.

## Correctness-adjacent

- **Pre-1.1 followed clubs have no `compId`** — no zustand persist migration; a club
  followed on Release 1 day falls back to `'sco.1'` links (wrong subtitle/squad fetch for
  non-Premiership clubs; identity and fixtures still render). Fix: persist `version` +
  `migrate`, or resolve `compId` from team caches at render.
- **`NextUpRow` links the crest via `fixture.compId`, not the club's own league** — a cup
  tie as next fixture links the team page under the cup's id. Cup team pages resolve
  (verified live), so the symptom is only a wrong competition subtitle.
- **European team pages have empty squads** — `uefa.champions` roster endpoint returns 0
  athletes (pre-existing R1 behaviour); squad section renders empty rather than the
  degraded line. Consider treating 0 players as "unavailable".

## Design polish

- **Quiet-day ordering** — on a no-football day the Quick view tables render above the
  "No matches today." line; the quiet line should probably come first.
- **Pre-season mini table** — before a league starts, all rows are 0 pts sorted
  alphabetically; a "not started yet" guard would read better.
- **Live minute lacks `tabular-nums`** (R1 deferral) — digit-width jitter as minutes tick.
- **Button-inside-Link** in FixtureRow/NextUpRow crest links — works and is tested, but is
  outside the HTML5 content model; ClubsScreen's sibling-Link pattern is the compliant
  alternative if a11y tooling ever complains.

## Structural

- **Today cold-start volume** — ~50 proxy calls on first paint (13 windows + 13 seasons
  incl. 12 BBC month windows each for two comps + 2 standings), all edge-cached and shared
  with team pages. Fine today; revisit if Today ever feels slow on cold cache.
- **Quick view hardcodes sco.1/eng.1** and ignores hidden-comps prefs (spec-conformant;
  revisit if prefs should win).
- **Channel naming** — spec says "Amazon Prime Video", code/README use "Amazon Prime".
  Curators should follow the README.
- **Cross-source club identity** (R1 note) — BBC team ids never match ESPN ids, so a
  followed League One club stars only its league fixtures.

## From the 1.2 final review (2026-08-14)

- **On TV can duplicate today's fixtures** already listed under Live/Later today (window
  starts at now, not tomorrow) — product call.
- **Calendar has no loading/error state** — cold cache shows an empty grid + "No fixtures
  this day" until data lands (sub-second via proxy).
- **selectedKey persists when paging months** — day list keeps showing a day from the
  previous month; self-labelled but worth clearing on page.
- **"No matches today." sits below On TV/Quick view** on quiet days — ordering call.
- **Dead useMemo over useQueries array** in CalendarScreen (recompute per render, no loop).
- **No live-status score test for FixtureRow** (only ft asserted; same boolean guards both).

## From the 2.0 final review (2026-08-14) — accepted behaviours

- The two clubs of a not-yet-published knockout tie briefly show as fallen (rule 2); self-corrects when the tie publishes.
- A postponed fixture stalls rule-2 eliminations for its whole round (singleLeg refinement still fires for decided ties).
- Structure-strip numerals are registry config, not derived (spec §13.10.1 ambiguity accepted; derived counts live in the tier sub-labels).
- Champion flourish untested against live data until a cup completes.

## From the 2.2 review (2026-08-15)

- Fixture rows now nest three interactive controls inside the row link (row/crest/context) — valid behaviour, invalid HTML content model; the sibling-Link restructure would clear it if a11y tooling complains.
- Sibling fixtures in the match room don't receive followedIds, so ★ never shows there.

## From the 2.4 review (2026-08-15) — accepted

- A late-published extra tie in an already-revealed round never gets its own ceremony (idempotence outranks completeness) and removes the round's replay link.
- DrawScreen conflates a dead feed with a nonexistent round in its honest line.
- Legacy-migration edge: a comp erroring at the exact moment the OLD global latch fired would show one false card post-upgrade (no real installs carry this; self-heals on view).

## From the 2.5 review (2026-08-16)

- Two followed clubs in one phase group who play EACH OTHER: completing one club's ceremony
  suppresses the other's invitation (all-unseen gate); recoverable via team-page replay.
  Follow-up: per-club seen-state or exclude the shared fixture from the gate.
- /draw/{comp}/{knockout-round}/{teamId} is reachable by hand-typed URL (renders coherently;
  nothing links to it) — tighten if URL hygiene ever matters.
- Invitation card copy adds comp name vs spec's terser line (accepted as improvement).

## From the 2.6 review (2026-08-16)

- Table movement and player ratings are built but dormant — ESPN currently zeroes rankChange
  and avgRatingFromDataFeed everywhere; sign convention (rankChange>0 = up) is an assumption,
  one-line flip if it ever reads inverted live.
- SplitBlock doesn't clamp pass-pct (safe on today's 0-1 fractions; would break on a 0-100 feed).
- Sheet opens as an empty shell on a cold fetch (jumps to content when the query resolves).
- Height renders ESPN's raw quotes (6' 1") vs the mockup's primes; discipline row left-packed.

## From the home-league hotfix review (2026-08-16)

- Fast-follow: useSquad's per-leg catch swallows real fetch errors identically to
  legit-empty rosters — a full outage caches 'Squad details unavailable.' as fresh for 24h
  (session-scoped). Distinguish clean-200-empty from errors; let the last leg's error throw.
- Squad fallback list is deliberately Scotland/England only — foreign UEFA opponents still
  have no squads (pre-existing; needs per-club domestic-league discovery to generalise).

## From the two-leg hotfix review (2026-08-16)

- Fast-follow: unrevealedDraws' ≥2-ties gate counts raw legs; a single-pairing two-leg round
  would slip through — change to dedupePairings(...).length < 2.
- The bowl/rollcall threshold was never actually broken by duplicates (distinctClubCount
  already Set-dedupes); pre-fix bowl at 14 distinct clubs was correct behaviour.

## From v0.9.0 final review (2026-08-16)
- RollcallList recomputes firstCurrentIndex per render unmemoized — negligible at roll-call sizes, tidy if ever hot.
- Bowl pool 2D adjacency: pairs can sit beside each other in the wrapping crest cloud; decided out of scope (cloud adjacency is fuzzy, ≤16 clubs). Revisit only if a user notices.
- UEFA overview editorial gap: the blurb describes the league phase while the field board (correctly, per §13.11) shows qualifying tiers in August — sentence and board describe different stages until the league phase draws. Consider a qualifying-aware second sentence next August.

## From v1.1.0 final review (2026-08-16)
- Nested interactive controls now sit inside a row BUTTON (was an anchor) — React's DOM-nesting validator logs dev-only errors on Today; the sibling-control restructure would clear it (same standing item, kind changed not just scale).
- TodayView.test.jsx mocks queries.js with only useNews — useMatchDetail is undefined there; will confuse the first TodayView test that taps a fixture row open.
- FixtureRow H2H drawer rows keyed by array index (static list per render; consistency nit).

## From v1.2.0 final review (2026-08-16)
- Domestic-shape guard also discards GENUINE rosters ESPN serves under qualifier slugs (Gornik-class, ~22/50 sampled clubs): they now show "Squad details unavailable." (same as pre-wave, honest, not a regression) though a real squad exists under uefa.*_qual. Future: fetch the non-domestic slug for the ROSTER while refusing to name it as a league.
- Scout-line phrasing is clunky at small N ("Won 1 of their last 1") — consider "Won their only league game so far" style special-casing.

## From v1.4.0 final review (2026-08-17)
- MatchLine's away-minute-label and tick-label rows share 4px of line-box leading (12px real line box vs 10px planned): a near-tick away goal stacks e.g. "2′" directly above "0′" — legible, no ink collision; give the bands 2px more headroom next time FixtureRow is open.
- Same-minute goals paint one dot (leading-minute parse, spec-mandated); duplicate club colours flatten the balance bar; venue composition differs between drawers (gameInfo with city vs bare fixture venue) — all accepted design consequences.
- Windows fork-pool flake can exit 0 while under-running the suite (worker start failures on 2 files) — re-run those files if counts look short.

## From §13.23 (match line on the fixture page, 2026-08-17)
- The known v1.4.0 band-leading item above ("2′" stacking above "0′") now surfaces in a SECOND
  place: the fixture page heading, verified live on Kilmarnock 1-5 Celtic (a 2′ away goal). Same
  4px leading overlap, still legible, still no ink collision — but the 2px headroom fix now buys
  two screens instead of one, so it is worth doing next time FixtureRow is open.
- Pre-existing nested-<button> DOM warning (standing v1.1.0 item) also fires on the match page
  via Siblings' FixtureRow crest buttons — same root cause, no new defect, logged here only so
  the match room is named in the eventual restructure.

## From the split-rule/lineups wave final review (2026-08-17)
- ~~Balance bar press-tone eyeball~~ RESOLVED by §13.26 unification (2026-08-17 evening):
  the drawer now renders the same BalanceBar component live-verified on the match page.
- Duplicate coloured-fixture constructions in MatchRoom.test.jsx (module-level colourFixture
  vs inline colouredFixture, different arbitrary colours) — consolidate next time the file opens.
- White-kit LIVE verification for split rules/dots still owed once the EPL starts (unit-pinned;
  a real Fulham/Spurs/Leeds match is the eyeball case).

## The unbuilt shortlist gains one (2026-08-17, late)
- THE EVERYWHERE SHEET: one app-level PlayerSheet host so player taps work from FixtureRow
  drawers (scorer rows are already shaped for it, spec 13.28) — not just MatchRoom. Joins
  Golden Boot, minute-by-minute, weekend planner, home/away splits, rivalry ledger.

## From the league-siblings fix (2026-08-20)
- Matchday-number grouping ("Matchday 5") for league siblings: the feed carries no week field
  (live-probed); inference from fixture sequence is possible but postponements make it fragile.
  Revisit only if same-day grouping proves insufficient across a real season.

## From the Local Club wave (2026-08-21)
- Vercel preview deployments are DISABLED for the project (branch pushes build nothing) —
  enable in the dashboard so future new-upstream gates can run on real Vercel IPs pre-merge.
- WoSFL cups (Scottish Cup group 492761491, League Cup 736799908 etc.) are one registry
  entry away each, same season list — add when Bellshill draw someone romantic.
- WOSFL season ids roll each July beside SEASON — one annual edit, documented in the registry.

## The unbuilt shortlist grows two (2026-08-22, late — user dreaming in-app)
- THE FULL TABLE (next quick session, bounded): a quiet "Full table" toggle on league tables —
  every column inline (P W D L GF GA GD Pts), row drawers resting while on, preference
  persisted in prefs. The accordion was a phone-width compromise, not a philosophy; the
  broadsheet prints full classifieds. One mockup decision: sideways-scroll container vs
  compressed columns on narrow screens.
- THE SCOUT'S DOSSIER (full wave, daylight hours): completes the scout trilogy (line, film,
  dossier). Wikipedia REST potted bio inline on the player sheet/page — the design HINGES on
  strict identity matching (wrong man's biography = worst never-mislead violation available;
  honest "no reliable dossier" degrade when unsure). usePlayerVideos as useTeamVideos'
  sibling (lazy, cached, grift-filtered). FPL layer attaches free for EPL players; junior
  players say so honestly. Portraits WELCOME (user rescinded the misread no-portraits line,
  2026-08-22): the dossier can carry the Wikipedia lead image, and FPL's 250px photos serve
  EPL players — with the ESPN-404 lore meaning faces come from those sources, never ESPN.

- ~~Highlights reel featured-tier misses~~ RESOLVED by the 13.41 nickname ledger (2026-08-29): Wolves/Spurs/Brighton prose now features. Remaining scope note only: clubs whose spoken name is a prefix of the registry name (Brighton & Hove Albion, Wolverhampton Wanderers) always print the plain tier - the synopsis never says the full name. Honest, never wrong; a uniqueness-checked first-token match could lift them if it rankles. Also scope: only each brand's LATEST episode joins - Saturday's results lose their line when Sunday's episode lands (episodes.json archive would extend it).

- Nested-button hydration warning on TeamScreen (observed 2026-09-01 during §13.50 live
  verification): the browser console prints React's "button cannot be a descendant of
  button" on /team pages — a row button wrapping an inner button somewhere in the
  next/last fixture cards. Pre-existing, cosmetic (no behavioural fault seen), but it is
  invalid HTML and a screen-reader wart; worth a small unwrap pass when next in that file.
