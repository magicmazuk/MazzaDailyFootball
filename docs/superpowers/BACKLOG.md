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
