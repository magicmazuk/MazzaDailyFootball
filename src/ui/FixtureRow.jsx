import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { byId } from '../domain/competitions.js';
import { prettifyRound } from '../domain/round.js';
import { useMatchDetail } from '../data/queries.js';
import Collapse from './Collapse.jsx';
import Crest from './Crest.jsx';
import { SkeletonLines } from './Skeleton.jsx';
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
      {comp.shortName}{round && ` · ${round}`}
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

// Scorers grouped by the side credited for each goal, then by player (spec
// §13.19.1): every goal one player scored collapses onto a single
// "Maeda 12′, 61′" line; different scorers on the same side join with
// ' · '. Events with no player, or that credit neither side, are skipped
// rather than crashing.
function scorersBySide(events, fixture) {
  const goalsBySide = { home: [], away: [] };
  for (const e of events ?? []) {
    if (!e.scoringPlay || e.player == null) continue;
    const side = creditedSide(e, fixture);
    if (side) goalsBySide[side].push(e);
  }
  const format = goals => {
    const order = [];
    const minutesByPlayer = new Map();
    for (const g of goals) {
      if (!minutesByPlayer.has(g.player)) {
        minutesByPlayer.set(g.player, []);
        order.push(g.player);
      }
      minutesByPlayer.get(g.player).push(`${g.minute}${goalMarker(g.type)}`);
    }
    return order.map(player => `${player} ${minutesByPlayer.get(player).join(', ')}`).join(' · ');
  };
  return { home: format(goalsBySide.home), away: format(goalsBySide.away) };
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

// Result drawer content (spec §13.19.1): each side's scorers, then
// attendance when the source published it, then the way through to the
// full page. A goalless side (or a goalless match) simply contributes no
// line — nothing to report is not a degraded state.
function ResultDrawer({ detail, fixture, comp }) {
  const scorers = scorersBySide(detail.events, fixture);
  const attendance = detail.gameInfo?.attendance;
  return (
    <>
      {scorers.home && <p className="text-[13px] mb-1">{fixture.home.name}: {scorers.home}</p>}
      {scorers.away && <p className="text-[13px] mb-1">{fixture.away.name}: {scorers.away}</p>}
      {attendance != null && (
        <p className="font-sans text-[10px] text-muted tabular-nums mt-2">
          Attendance {Number(attendance).toLocaleString('en-GB')}
        </p>
      )}
      <FullDetailLink comp={comp} fixture={fixture} />
    </>
  );
}

// Upcoming drawer content (spec §13.19.1): the last three head-to-head
// meetings, most recent first — sorted here rather than trusted from the
// feed, since seasonseries' event order isn't guaranteed. "No recent
// meetings." keeps the line honest rather than blank when there are none.
function UpcomingDrawer({ detail, fixture, comp }) {
  const meetings = [...(detail.headToHead?.meetings ?? [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);
  return (
    <>
      {meetings.length === 0
        ? <p className="text-[13px] text-muted mb-1">No recent meetings.</p>
        : meetings.map((m, i) => (
          <p key={i} className="text-[12px] mb-1">
            {shortDate(m.date)} · {m.homeName} {m.homeScore}–{m.awayScore} {m.awayName}
          </p>
        ))}
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
