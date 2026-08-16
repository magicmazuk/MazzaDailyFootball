import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { byId } from '../domain/competitions.js';
import { prettifyRound } from '../domain/round.js';
import { useMatchDetail } from '../data/queries.js';
import Crest from './Crest.jsx';
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

// Scorers grouped by side then by player (spec §13.19.1): every goal one
// player scored collapses onto a single "Maeda 12′, 61′" line; different
// scorers on the same side join with ' · '. Events with no player, or
// whose teamId matches neither side, are skipped rather than crashing.
function scorersForSide(events, teamId) {
  const goals = (events ?? []).filter(e => e.scoringPlay && e.player != null && e.teamId === teamId);
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
  const homeScorers = scorersForSide(detail.events, fixture.home.teamId);
  const awayScorers = scorersForSide(detail.events, fixture.away.teamId);
  const attendance = detail.gameInfo?.attendance;
  return (
    <>
      {homeScorers && <p className="text-[13px] mb-1">{fixture.home.name}: {homeScorers}</p>}
      {awayScorers && <p className="text-[13px] mb-1">{fixture.away.name}: {awayScorers}</p>}
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
  const { data, isLoading, isError } = useMatchDetail(comp, fixture.id, false);
  return (
    <div className="bg-drawer -mx-5 px-5 py-4">
      {isLoading && (
        <p className="font-sans text-[11px] text-muted">Fetching the detail…</p>
      )}
      {!isLoading && isError && (
        <p className="font-sans text-[11px] text-muted">Match detail unavailable.</p>
      )}
      {!isLoading && !isError && (
        fixture.status === 'ft'
          ? <ResultDrawer detail={data?.detail ?? {}} fixture={fixture} comp={comp} />
          : <UpcomingDrawer detail={data?.detail ?? {}} fixture={fixture} comp={comp} />
      )}
    </div>
  );
}

export default function FixtureRow({ fixture, followedIds = new Set(), showContext = true }) {
  const [open, setOpen] = useState(false);
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
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="w-full text-left block py-3 border-b border-rule/70">
        {body}
      </button>
      {open && <FixtureDrawer comp={comp} fixture={fixture} />}
    </div>
  );
}
