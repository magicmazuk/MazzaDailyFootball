import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { byId } from '../domain/competitions.js';
import { monogram } from '../domain/monogram.js';
import { legLabel, tieLine } from '../domain/legs.js';
import { prettifyRound } from '../domain/round.js';
import { useMatchDetail } from '../data/queries.js';
import { useFixtureHighlight } from '../features/match/highlight.js';
import Collapse from './Collapse.jsx';
import Crest from './Crest.jsx';
import { SkeletonLines } from './Skeleton.jsx';
import Shirt from './Shirt.jsx';
import StatusWord from './StatusWord.jsx';
import TvBadge from './TvBadge.jsx';

// The fixture's competition context (spec §13.12): shortName + round,
// above the two TeamLines, on by default — team pages, calendar days and
// the On TV list span many comps and benefit from the reminder. Its own
// page (CompetitionScreen's Fixtures/Results tabs) turns it off since the
// context is the page itself. Unknown compId (should never happen, but
// never a crash) renders nothing rather than a blank/undefined line.
function ContextLine({ fixture }) {
  const navigate = useNavigate();
  const comp = byId(fixture.compId);
  if (!comp) return null;
  const round = prettifyRound(fixture.round);
  const toCompetition = e => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/competition/${fixture.compId}`);
  };
  return (
    <button type="button" onClick={toCompetition} aria-label={`${comp.shortName} page`}
      className="font-sans text-[8.5px] uppercase tracking-[.16em] text-muted mb-0.5
                 text-left block truncate">
      {comp.shortName}{round && ` · ${round}`}{fixture.leg != null && ` · ${legLabel(fixture.leg)}`}
    </button>
  );
}

// The club-link rule (spec §13.2): the crest is the team link, the rest
// of the row is the match link. No nested anchors — the inner control
// navigates programmatically.
function TeamLine({ side, compId, followed, dim, showScore }) {
  const navigate = useNavigate();
  const toTeam = e => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/team/${compId}/${side.teamId}`);
  };
  return (
    <div className={`flex items-center gap-2.5 ${dim ? 'opacity-50' : ''}`}>
      <button type="button" onClick={toTeam} aria-label={`${side.name} team page`}
        className="shrink-0">
        <Crest side={side} size={22} />
      </button>
      <span className="font-serif text-[15px] truncate flex-1">
        {side.name}
        {followed && <span className="text-accent text-[9px] align-middle ml-1.5">★</span>}
      </span>
      {showScore && side.score != null && (
        <span className="font-serif text-[17px] tabular-nums">{side.score}</span>
      )}
    </div>
  );
}

// The row's own content (spec §13.19.1) — identical whether the row ends
// up wrapped in a Link (navigate) or a button (toggle the drawer), so the
// two wrapper branches below share this rather than duplicating it.
function RowBody({ fixture, followedIds, showContext, dim, showScore }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-12 shrink-0 pt-1 space-y-1.5">
        <StatusWord fixture={fixture} />
        <TvBadge tv={fixture.tv} />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {showContext && <ContextLine fixture={fixture} />}
        <TeamLine side={fixture.home} compId={fixture.compId} showScore={showScore}
          followed={followedIds.has(fixture.home.teamId)} dim={dim} />
        <TeamLine side={fixture.away} compId={fixture.compId} showScore={showScore}
          followed={followedIds.has(fixture.away.teamId)} dim={dim} />
      </div>
    </div>
  );
}

const shortDate = iso => new Date(iso).toLocaleDateString('en-GB',
  { day: 'numeric', month: 'short', year: 'numeric' });

// A goal event's qualifier (spec §13.19.1) — a penalty or own goal keeps
// its marker beside the minute, exactly like the match room's timeline;
// a plain run-of-play goal carries none.
function goalMarker(type = '') {
  if (/penalty/i.test(type)) return ' (pen)';
  if (/own goal/i.test(type)) return ' (og)';
  return '';
}

// Which side a goal event credits (spec §13.19.1): e.teamId's own side,
// for own goals too — verified against the LIVE feed at the v1.1 final
// review (8 own goals across eng.1/sco.1: ESPN's keyEvents[].team.id is
// always the team the goal counts FOR, and the per-teamId tally reproduces
// every final scoreline exactly; e.g. O'Hora's og in Hibs 1-2 Hearts
// carries the Hearts id). Do NOT "flip" own goals to the other side — a
// fix round tried that on the strength of a hand-authored test fixture
// and it inverted real drawers. The (og) marker still renders; only the
// grouping stays raw. Returns null when the teamId matches neither side.
function creditedSide(event, fixture) {
  if (event.teamId === fixture.home.teamId) return 'home';
  if (event.teamId === fixture.away.teamId) return 'away';
  return null;
}

// A player's surname (spec §13.22, task 1: the match line's scorer
// columns) — the last word of their full name, so "Daizen Maeda" reads as
// "Maeda" beside its minutes fragment, matching a scorecard's convention.
export function surnameOf(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : (name ?? '');
}

// Scorers grouped by the side credited for each goal, then by player (spec
// §13.19.1, redrawn per spec §13.22 task 1): every goal one player scored
// collapses onto a single line — surname + its minutes joined by commas
// ("Miller 82′ (pen), 90+4′") — one line per scorer, in first-goal order.
// Events with no player, or that credit neither side, are skipped rather
// than crashing.
// Shirt numbers live on the rosters, not the goal events — but the drawer's
// summary payload carries BOTH, so each scorer's number is looked up by
// playerId (name as fallback) across every roster entry, subs included (a
// sub can score) and BOTH sides (an own-goal scorer is credited to the
// benefiting column but plays for the other club — the number is real, the
// (og) marker carries the story). No match: null, and the Shirt renders
// numberless rather than wrong.
export function shirtLookup(lineups) {
  const byId = new Map();
  const byName = new Map();
  for (const l of lineups ?? []) {
    for (const pl of l.players ?? []) {
      if (pl.id != null && !byId.has(pl.id)) byId.set(pl.id, pl.shirt ?? null);
      if (pl.name && !byName.has(pl.name)) byName.set(pl.name, pl.shirt ?? null);
    }
  }
  return (playerId, name) => byId.get(playerId) ?? byName.get(name) ?? null;
}

function scorersBySide(events, fixture, lineups) {
  const goalsBySide = { home: [], away: [] };
  for (const e of events ?? []) {
    if (!e.scoringPlay || e.player == null) continue;
    const side = creditedSide(e, fixture);
    if (side) goalsBySide[side].push(e);
  }
  const shirtFor = shirtLookup(lineups);
  const build = goals => {
    const order = [];
    const minutesByPlayer = new Map();
    const idByPlayer = new Map();
    for (const g of goals) {
      if (!minutesByPlayer.has(g.player)) {
        minutesByPlayer.set(g.player, []);
        idByPlayer.set(g.player, g.playerId ?? null);
        order.push(g.player);
      }
      // ESPN's clock strings carry straight apostrophes ("90'+4'"); the
      // match line above renders primes — one drawer, one mark (v1.4
      // final review, L2; same conversion player.js applies to heights).
      minutesByPlayer.get(g.player).push(`${String(g.minute).replace(/'/g, '′')}${goalMarker(g.type)}`);
    }
    return order.map(player => ({
      player,
      shirt: shirtFor(idByPlayer.get(player), player),
      minutesText: minutesByPlayer.get(player).join(', '),
    }));
  };
  return { home: build(goalsBySide.home), away: build(goalsBySide.away) };
}

// A goal event's leading minute integer (spec §13.22, task 1: the match
// line) — "90'+4'" and "105'" both parse via their LEADING digits only, so
// a stoppage-time goal keeps the minute it was added to (90), not the
// stoppage count. Unparseable/absent minutes return null so the caller can
// skip them rather than plot a NaN.
// The press tone (spec §13.24, hardened in the review round): every
// club-coloured FILL prints at 75%, through this ONE helper so the tone can
// never drift between the goal dots, the balance bar and the stats' split
// rules (the SOFT-75 retune had to hand-edit three copies; never again).
// Only a six-digit feed hex is paintable — anything else (3-digit,
// hash-prefixed, junk) falls back to muted exactly like a missing colour,
// rather than producing invalid CSS that drops the fill AND skips the
// fallback. Shirt.jsx stays deliberately outside this: icons at 11-18px
// keep their full-strength treatment (spec §13.24 carve-out).
const SIX_HEX = /^[0-9a-f]{6}$/i;
export function pressFill(clubSide) {
  const paintable = clubSide?.colour != null && SIX_HEX.test(clubSide.colour);
  return {
    className: paintable ? '' : 'bg-muted',
    style: paintable ? { background: `#${clubSide.colour}bf` } : undefined,
  };
}

function leadingMinute(raw) {
  const m = /^(\d+)/.exec(raw ?? '');
  return m ? Number(m[1]) : null;
}

// The match line's goal positions (spec §13.22, task 1), exported for
// direct unit-testing of the scale/clamp/skip logic. A 90-minute axis
// stretches to 120 the moment any goal's leading minute passes 90 (extra
// time); every goal's pct is clamped to the resulting scale so a genuine
// outlier (e.g. 130') still lands on the right edge instead of overflowing
// past 100%. Labels are thinned per side: a dot within 7% of the last
// LABELLED dot on the SAME side goes unlabelled (busy scrambles, e.g. a
// stoppage-time flurry, still read as one moment rather than a smear of
// overlapping numerals) — the other side's labels are unaffected.
export function timelinePoints(events, fixture) {
  const goals = (events ?? [])
    .filter(e => e.scoringPlay)
    .map(e => ({ minute: leadingMinute(e.minute), side: creditedSide(e, fixture) }))
    .filter(e => e.minute != null && e.side)
    .sort((a, b) => a.minute - b.minute);
  if (goals.length === 0) return [];
  const scale = goals.some(g => g.minute > 90) ? 120 : 90;
  const lastLabelledPct = { home: null, away: null };
  return goals.map(g => {
    const pct = Math.min(g.minute, scale) / scale * 100;
    const last = lastLabelledPct[g.side];
    const labelled = last == null || Math.abs(pct - last) >= 7;
    if (labelled) lastLabelledPct[g.side] = pct;
    return { pct, side: g.side, minute: g.minute, labelled };
  });
}

// The head-to-head balance (spec §13.22, task 1: the balance bar), exported
// for direct unit-testing of the attribution. Meetings carry only
// homeName/awayName (espn.js's adaptHeadToHead — no teamId), so a club is
// identified by matching its NAME against this fixture's own home/away
// sides — the only two clubs a head-to-head meeting can ever involve.
// Whichever side THIS fixture's home club played in a given meeting (it
// flips freely across meetings), a win for that club counts as homeWins;
// same logic, mirrored, for the away club. Draws are orientation-agnostic.
export function meetingBalance(meetings, fixture) {
  const result = { homeWins: 0, draws: 0, awayWins: 0 };
  for (const m of meetings ?? []) {
    if (m.homeScore == null || m.awayScore == null) continue;
    if (m.homeScore === m.awayScore) { result.draws += 1; continue; }
    const winnerName = m.homeScore > m.awayScore ? m.homeName : m.awayName;
    if (winnerName === fixture.home.name) result.homeWins += 1;
    else if (winnerName === fixture.away.name) result.awayWins += 1;
  }
  return result;
}

function FullDetailLink({ comp, fixture }) {
  return (
    <Link to={`/match/${comp.id}/${fixture.id}`}
      className="font-sans text-[9.5px] uppercase tracking-[.14em] text-muted underline
                 underline-offset-4 inline-block mt-4">
      Full detail →
    </Link>
  );
}

// The match line (spec §13.22, task 1): ninety minutes (widened to 120 the
// moment any goal's leading minute passes 90) as a single hairline axis —
// home goals above, away below, half-time ticked. Always renders, even
// with zero points: the bare axis IS the 0-0 story (brief, task 1c).
// Tick/minute-label typography: the muted 8px sans (MonthGrid's own
// overflow-count recipe), plus tabular-nums for the numerals — a variant,
// not a new size/tracking/weight combination.
export function MatchLine({ points, fixture }) {
  const scale = points.some(p => p.minute > 90) ? 120 : 90;
  const ticks = [
    { pos: 'left', label: '0′' },
    { pos: 'center', pct: (45 / scale) * 100, label: 'HT' },
    ...(scale === 120 ? [{ pos: 'center', pct: (90 / scale) * 100, label: '90′' }] : []),
    { pos: 'right', label: `${scale}′` },
  ];
  // border-ink: the Shirt.jsx idiom — every club-coloured shape carries a
  // 1px ink outline so a pale kit (Fulham/Spurs/Leeds are literally
  // #ffffff in the feed) still reads as a shape on the drawer tone
  // (v1.4 final review, M1).
  const dotClass = clubSide => `absolute w-[9px] h-[9px] rounded-full border border-ink/60 -translate-x-1/2 -translate-y-1/2 ${
    pressFill(clubSide).className}`;
  // Vertical bands, top to bottom (v1.4 final review, M2 — tick labels
  // used to share the away-dot band, so an early or stoppage-time away
  // goal overpainted "0′"/"HT"/"90′"): home minute labels 0-10, home dots
  // ~15-25, axis 30, away dots ~35-45, away minute labels 46-56, tick
  // labels 56-66. Each row owns its strip; nothing overlaps.
  return (
    <div className="relative h-[66px] mt-2 mb-1">
      <div data-testid="match-axis" className="absolute inset-x-0 top-[30px] h-px bg-ink" />
      {ticks.map(t => (
        <span key={t.label}
          className={`absolute bottom-0 font-sans text-[8px] text-muted tabular-nums ${
            t.pos === 'left' ? 'left-0' : t.pos === 'right' ? 'right-0' : '-translate-x-1/2'}`}
          style={t.pos === 'center' ? { left: `${t.pct}%` } : undefined}>
          {t.label}
        </span>
      ))}
      {points.map((p, i) => (
        <span key={`dot-${i}`} data-testid="goal-dot" data-side={p.side}
          className={`${dotClass(fixture[p.side])} ${p.side === 'home' ? 'top-[20px]' : 'top-[40px]'}`}
          style={{ left: `${p.pct}%`, ...pressFill(fixture[p.side]).style }} />
      ))}
      {points.filter(p => p.labelled).map((p, i) => (
        <span key={`lab-${i}`}
          className={`absolute -translate-x-1/2 font-sans text-[8px] text-muted tabular-nums ${
            p.side === 'home' ? 'top-0' : 'top-[46px]'}`}
          style={{ left: `${p.pct}%` }}>
          {p.minute}′
        </span>
      ))}
    </div>
  );
}

// One scorer column (spec §13.22, task 1b): the FieldBoard muted sub-label
// recipe over the club's shortName, then one line per scorer — surname in
// the drawer's existing serif content size, minutes fragment in a muted
// sans tabular style (markers kept, e.g. "82′ (pen), 90+4′"). Always
// renders its label even with zero scorers (the 0-0 "empty column" case).
function ScorerColumn({ clubSide, scorers, testId }) {
  return (
    <div data-testid={testId}>
      <p className="font-sans text-[9px] uppercase tracking-[.14em] text-muted mb-3">
        {clubSide.shortName ?? clubSide.name}
      </p>
      {/* The lineups' row form (spec §13.28): shirt in the COLUMN club's
          colour with the scorer's real number, full name on one truncating
          line, the minutes fragment held whole at the end. */}
      {scorers.map(s => (
        <div key={s.player} data-testid="scorer-row"
          className="flex items-center gap-2.5 py-1.5 min-w-0">
          <Shirt colour={clubSide.colour ?? null} number={s.shirt} size={20} />
          <span className="text-[13px] truncate min-w-0">{s.player}</span>
          <span className="font-sans text-[10.5px] text-muted tabular-nums shrink-0">{s.minutesText}</span>
        </div>
      ))}
    </div>
  );
}

// Result drawer content (spec §13.19.1, redrawn per spec §13.22 task 1 —
// "the match line"): the goal timeline, two scorer columns, then venue +
// attendance whichever the source published, then the way through to the
// full page.
function ResultDrawer({ detail, fixture, comp }) {
  // The highlight line (spec §13.36, R-A) — safe to hook here: the drawer
  // mounts lazily on first expand, so nothing fetches before the tap.
  const highlight = useFixtureHighlight(fixture, comp);
  const points = timelinePoints(detail.events, fixture);
  const scorers = scorersBySide(detail.events, fixture, detail.lineups);
  const tie = tieLine(fixture);
  // Attendance 0 is "not reported", never a crowd of none (never-mislead;
  // user report 2026-08-25) — the feed publishes 0 before the count lands.
  const attendance = detail.gameInfo?.attendance;
  const metaParts = [
    detail.gameInfo?.venue,
    Number(attendance) > 0 ? `Attendance ${Number(attendance).toLocaleString('en-GB')}` : null,
  ].filter(Boolean);
  return (
    <>
      <MatchLine points={points} fixture={fixture} />
      <div className="grid grid-cols-2 gap-x-4 mt-3">
        <ScorerColumn clubSide={fixture.home} scorers={scorers.home} testId="scorer-col-home" />
        <ScorerColumn clubSide={fixture.away} scorers={scorers.away} testId="scorer-col-away" />
      </div>
      {/* The tie's verdict (spec §13.29), in the shootout line's accent
          recipe — printed even (especially) when this leg's own score
          points the other way. A won leg must never read as a won tie. */}
      {tie && (
        <p data-testid="tie-line" className="font-sans text-[10px] text-accent mt-2">
          {tie.level
            ? `${tie.winnerName} through — ${tie.winnerAgg}–${tie.loserAgg} on aggregate`
            : `${tie.winnerName} through ${tie.winnerAgg}–${tie.loserAgg} on aggregate`}
        </p>
      )}
      {metaParts.length > 0 && (
        <p className="font-sans text-[10px] text-muted tabular-nums mt-2">{metaParts.join(' · ')}</p>
      )}
      {/* Watch it back (spec §13.36, R-A): the covered episode's line in
          the Full-table accent recipe, linking out to iPlayer — never
          embedded (DRM). No episode, no line: §13.36 exempts absence here
          from the one-line law, since coverage was never promised. */}
      {highlight && (
        <a data-testid="highlight-line" href={highlight.url}
          target="_blank" rel="noopener noreferrer"
          className="font-sans text-[10px] uppercase tracking-[.16em] text-accent mt-2 block">
          {highlight.line} — iPlayer →
        </a>
      )}
      <FullDetailLink comp={comp} fixture={fixture} />
    </>
  );
}

// A meeting side, resolved onto this fixture's own club records (spec
// §13.22, task 1: the ledger) — head-to-head meetings carry only names
// (espn.js's adaptHeadToHead has no teamId), and a meeting can only ever
// be between THIS fixture's two clubs, so matching by name recovers the
// crest the meeting's own row can't carry. An unmatched name (should never
// happen) still renders via the monogram fallback rather than crashing.
function meetingSide(name, fixture) {
  if (name === fixture.home.name) return fixture.home;
  if (name === fixture.away.name) return fixture.away;
  return { name, crestUrl: null, monogram: monogram(name) };
}

// One head-to-head meeting row (spec §13.22, task 1b): a fixed-width date
// column (the muted sans tabular recipe), then that meeting's OWN
// home/away order — crest, tabular serif score, crest.
export function MeetingRow({ meeting, fixture }) {
  const home = meetingSide(meeting.homeName, fixture);
  const away = meetingSide(meeting.awayName, fixture);
  return (
    <div data-testid="meeting-row" className="flex items-center gap-2.5 py-1">
      <span className="w-[84px] shrink-0 font-sans text-[10px] text-muted tabular-nums">
        {shortDate(meeting.date)}
      </span>
      <span className="flex items-center gap-2 text-[13px] tabular-nums">
        <Crest side={home} size={20} />
        {meeting.homeScore}–{meeting.awayScore}
        <Crest side={away} size={20} />
      </span>
    </div>
  );
}

// The balance bar (spec §13.22, task 1c): a club-coloured proportion of
// the shown meetings' outcomes — THIS fixture's home club's wins on the
// left (its colour), draws the quiet middle (bg-rule always — no club
// owns a draw), this fixture's away club's wins on the right (its
// colour). The caller only mounts this once meetings.length > 0, so total
// is always > 0 here; the guard is defensive, not reachable in practice.
export function BalanceBar({ homeWins, draws, awayWins, fixture }) {
  const total = homeWins + draws + awayWins;
  if (total === 0) return null;
  const pct = n => (n / total) * 100;
  // The split-rule theme (spec §13.26, B-JOIN chosen with S-A live on the
  // user's phone): the possession bar's weight — rule track, press-tone
  // wins from each end, draws as the quiet middle held between two
  // 60%-ink ticks at the outcome boundaries. Equal boundaries (no draws)
  // collapse to one tick; edge boundaries clip inside overflow-hidden the
  // same as the stats page's shutout ticks. The v1.4 frame-and-dividers
  // form retired here — its white-kit duty now falls to track + ticks,
  // exactly as the review round established for the split rules.
  const boundaries = [...new Set([pct(homeWins), pct(homeWins + draws)])];
  return (
    <>
      <div className="relative overflow-hidden h-[8px] mt-1.5 mb-1.5">
        <div className="absolute inset-x-0 top-[2.5px] h-[3px] flex bg-rule">
          {homeWins > 0 && (
            <div data-testid="balance-seg-home" className={`h-full ${pressFill(fixture.home).className}`}
              style={{ width: `${pct(homeWins)}%`, ...pressFill(fixture.home).style }} />
          )}
          {draws > 0 && (
            <div data-testid="balance-seg-draws" className="h-full bg-rule" style={{ width: `${pct(draws)}%` }} />
          )}
          {awayWins > 0 && (
            <div data-testid="balance-seg-away" className={`h-full flex-1 ${pressFill(fixture.away).className}`}
              style={pressFill(fixture.away).style} />
          )}
        </div>
        {boundaries.map(b => (
          <span key={b} data-testid="balance-tick" style={{ left: `${b}%` }}
            className="absolute inset-y-0 w-px bg-ink/60 -translate-x-1/2" />
        ))}
      </div>
      <div className="flex justify-between font-sans text-[10px] text-muted tabular-nums">
        <span>{fixture.home.shortName ?? fixture.home.name} {homeWins}</span>
        <span>drawn {draws}</span>
        <span>{fixture.away.shortName ?? fixture.away.name} {awayWins}</span>
      </div>
    </>
  );
}

// Weekday-date and kickoff-time formatting (spec §13.22, task 1d) — the
// app's existing en-GB conventions, exactly as NextUpRow/TodayView/
// roundGroups already format a fixture's day, and StatusWord already
// formats its kickoff clock.
const weekdayDate = iso => new Date(iso).toLocaleDateString('en-GB',
  { weekday: 'short', day: 'numeric', month: 'short' });
const kickoffTime = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// Upcoming drawer content (spec §13.19.1, redrawn per spec §13.22 task 1 —
// "the ledger + the balance"): the last three head-to-head meetings as
// aligned rows, most recent first — sorted here rather than trusted from
// the feed, since seasonseries' event order isn't guaranteed — then the
// balance those meetings strike between the two clubs. "No recent
// meetings." keeps the line honest rather than blank when there are none
// (and there's no proportion left to bar).
function UpcomingDrawer({ detail, fixture, comp }) {
  const meetings = [...(detail.headToHead?.meetings ?? [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);
  const { homeWins, draws, awayWins } = meetingBalance(meetings, fixture);
  const metaParts = [
    fixture.venue,
    fixture.kickoff ? weekdayDate(fixture.kickoff) : null,
    fixture.kickoff ? kickoffTime(fixture.kickoff) : null,
  ].filter(Boolean);
  return (
    <>
      <p className="font-sans text-[9px] uppercase tracking-[.14em] text-muted mb-3">Recent meetings</p>
      {meetings.length === 0
        ? <p className="text-[13px] text-muted mb-1">No recent meetings.</p>
        : (
          <>
            <div className="mb-1">
              {meetings.map((m, i) => <MeetingRow key={i} meeting={m} fixture={fixture} />)}
            </div>
            <BalanceBar homeWins={homeWins} draws={draws} awayWins={awayWins} fixture={fixture} />
          </>
        )}
      {metaParts.length > 0 && (
        <p className="font-sans text-[10px] text-muted tabular-nums mt-2">{metaParts.join(' · ')}</p>
      )}
      <FullDetailLink comp={comp} fixture={fixture} />
    </>
  );
}

// The inline drawer (spec §13.19.1): the LeagueTable Drawer's own
// furniture — same background, same negative-margin bleed, same underline
// link style — so a tapped fixture row reads as the same piece of the
// page as a tapped table row. Mounted only while its row is open, so the
// summary fetch behind useMatchDetail never fires until the first tap.
function FixtureDrawer({ comp, fixture }) {
  // isLoading (never isFetching): React Query v5 defines isLoading as
  // isPending && isFetching — true only while there's no cached data yet.
  // What actually keeps a re-opened drawer skeleton-free is cache
  // PRESENCE, not staleTime: isPending flips false the instant this query
  // has ever resolved, so a stale-but-cached reopen still refetches in the
  // background (isFetching true) but isLoading stays false throughout.
  const { data, isLoading, isError } = useMatchDetail(comp, fixture.id, false);
  return (
    <div className="bg-drawer px-5 py-4">
      {isLoading && <SkeletonLines lines={3} />}
      {!isLoading && isError && (
        <p className="font-sans text-[11px] text-muted">Match detail unavailable.</p>
      )}
      {!isLoading && !isError && (
        <div className="xfade-in">
          {fixture.status === 'ft'
            ? <ResultDrawer detail={data?.detail ?? {}} fixture={fixture} comp={comp} />
            : <UpcomingDrawer detail={data?.detail ?? {}} fixture={fixture} comp={comp} />}
        </div>
      )}
    </div>
  );
}

export default function FixtureRow({ fixture, followedIds = new Set(), showContext = true }) {
  const [open, setOpen] = useState(false);
  // Lazy-ONCE mounting (fix round 1, HIGH): nothing mounts before the
  // first tap (useMatchDetail still never fires before then), but once
  // opened, FixtureDrawer STAYS mounted so a later close glides shut
  // around real content instead of an already-empty box — the
  // `open && <FixtureDrawer/>` gate used to unmount it in the SAME commit
  // that flipped `open` false, and Collapse's close choreography (a layout
  // effect, which runs AFTER that DOM mutation) pinned and glided an empty
  // div. useMatchDetail is cached/idle once mounted, so staying mounted
  // after close costs nothing extra.
  const [everOpened, setEverOpened] = useState(false);
  const dim = fixture.status === 'postponed' || fixture.status === 'canceled';
  // ESPN reports score:"0" before kickoff — never render a score for a
  // fixture that hasn't started or finished, or every scheduled match
  // in the calendar/On TV/fixture lists would show a phantom 0-0.
  const showScore = fixture.status === 'live' || fixture.status === 'ft';
  const comp = byId(fixture.compId);
  // The drawer pattern (spec §13.19.1) applies only where there's detail
  // worth unfolding: a finished or upcoming fixture on an ESPN competition
  // that publishes match detail. A live/HT fixture keeps the direct Link
  // (the room is what you want mid-match), and so does anything with no
  // detail to show (a BBC comp, or hasMatchDetail: false).
  const expandable = comp?.source === 'espn' && !!comp?.hasMatchDetail
    && (fixture.status === 'ft' || fixture.status === 'scheduled');

  const body = (
    <RowBody fixture={fixture} followedIds={followedIds} showContext={showContext}
      dim={dim} showScore={showScore} />
  );

  if (!expandable) {
    return (
      <Link to={`/match/${fixture.compId}/${fixture.id}`}
        className="block py-3 border-b border-rule/70">
        {body}
      </Link>
    );
  }

  return (
    <div>
      <button type="button" aria-expanded={open}
        onClick={() => { setOpen(o => !o); setEverOpened(true); }}
        className="w-full text-left block py-3 border-b border-rule/70">
        {body}
      </button>
      {/* The full-bleed (-mx-5, escaping AppShell's page padding) lives on
          the Collapse itself: its overflow-hidden — load-bearing for the
          height clip — would otherwise clip the drawer's own negative-
          margin overhang and inset the box (v1.3.1 hotfix, user report). */}
      <Collapse open={open} className="-mx-5">
        {everOpened && <FixtureDrawer comp={comp} fixture={fixture} />}
      </Collapse>
    </div>
  );
}
