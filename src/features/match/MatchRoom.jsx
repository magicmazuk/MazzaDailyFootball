// The match room (spec §7.6, §13.8): kicker and date, score and clock,
// venue/attendance/referee, form coming in, a vertical timeline of moments
// newest first, then stats, standouts, lineups and head-to-head. Degrades
// to a clean scoreline plus one honest line where the source publishes no
// detail.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Crest from '../../ui/Crest.jsx';
import FixtureRow, { BalanceBar, MatchLine, MeetingRow, meetingBalance, pressFill,
  timelinePoints } from '../../ui/FixtureRow.jsx';
import FormGlyphs from '../../ui/FormGlyphs.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import Shirt from '../../ui/Shirt.jsx';
import StatusWord from '../../ui/StatusWord.jsx';
import TvBadge from '../../ui/TvBadge.jsx';
import { legLabel, tieLine } from '../../domain/legs.js';
import { prettifyRound } from '../../domain/round.js';
import PlayerSheet from '../player/PlayerSheet.jsx';
import VideoCard from './VideoCard.jsx';

// Tappable player names (spec §13.16): standouts, lineups and timeline
// names open the peek sheet when a playerId is known AND the comp is an
// ESPN one — BBC comps carry no player ids at all, and a plain name with
// no id would only open a sheet with nothing to show. Everywhere else
// (no id, or a BBC comp) stays exactly the plain text it always was.
const canTapPlayer = (comp, playerId) => comp?.source === 'espn' && playerId != null;

// A player name that becomes a button (opening the peek sheet) when
// tappable, otherwise the same plain <span> as before — used anywhere the
// name already lives in its own isolated element (timeline rows, lineup
// rows), where swapping the wrapping element doesn't change surrounding text.
function PlayerTap({ name, playerId, comp, onOpen, className }) {
  if (canTapPlayer(comp, playerId)) {
    return <button type="button" onClick={() => onOpen(playerId)} className={className}>{name}</button>;
  }
  return <span className={className}>{name}</span>;
}

const STAT_LABELS = {
  possessionPct: 'Possession', totalShots: 'Shots', shotsOnTarget: 'On target',
  wonCorners: 'Corners', foulsCommitted: 'Fouls', yellowCards: 'Yellow cards',
  redCards: 'Red cards', offsides: 'Offsides', saves: 'Saves',
};

const fullDate = iso => new Date(iso).toLocaleDateString('en-GB',
  { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const shortDate = iso => new Date(iso).toLocaleDateString('en-GB',
  { day: 'numeric', month: 'short', year: 'numeric' });

// Maps an event's teamId onto the fixture side (home/away) it belongs to,
// so the timeline can show that side's crest. An unrecognised teamId (or
// none at all) simply carries no crest — never a broken image.
function sideForTeam(fixture, teamId) {
  if (teamId == null) return null;
  if (fixture.home.teamId === teamId) return fixture.home;
  if (fixture.away.teamId === teamId) return fixture.away;
  return null;
}

// The season/today cache can be up to an hour stale during a live match.
// When the summary endpoint's fresher header score is available, overlay
// it onto the fixture sides shown in the header — matched by teamId, with
// a fallback to the cached fixture score for a side liveScore doesn't cover.
function withLiveScore(fixture, liveScore) {
  if (!liveScore) return fixture;
  const overlay = side => {
    const fresher = side.teamId === liveScore.home?.teamId ? liveScore.home
      : side.teamId === liveScore.away?.teamId ? liveScore.away
      : null;
    return fresher && fresher.score != null ? { ...side, score: fresher.score } : side;
  };
  return { ...fixture, home: overlay(fixture.home), away: overlay(fixture.away) };
}

// Both sides carry a penaltyScore only after a shootout; the higher one won.
function penaltyResult(fixture) {
  const h = fixture.home.penaltyScore;
  const a = fixture.away.penaltyScore;
  if (h == null || a == null) return null;
  const homeWon = h > a;
  return {
    winnerName: homeWon ? fixture.home.name : fixture.away.name,
    winnerScore: homeWon ? h : a,
    loserScore: homeWon ? a : h,
  };
}

// Venue, attendance and referee in one quiet line — only the parts the
// source actually published, joined with ' · '. gameInfo.venue (which
// carries the city too) is preferred over the fixture's bare venue name;
// the whole line is absent when there's no gameInfo to draw from.
function MetadataLine({ fixture, gameInfo }) {
  if (!gameInfo) return null;
  const venue = gameInfo.venue ?? fixture.venue;
  const attendance = gameInfo.attendance != null
    ? Number(gameInfo.attendance).toLocaleString('en-GB')
    : null;
  const parts = [venue, attendance, gameInfo.referee].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="font-sans text-[10px] text-muted mt-1.5">{parts.join(' · ')}</p>
  );
}

function ScoreHeader({ fixture, comp, gameInfo, events, otherLeg }) {
  const pens = penaltyResult(fixture);
  const tie = tieLine(fixture);
  // ESPN reports score:"0" before kickoff — a scheduled or postponed fixture
  // shows a dash, the same as a genuinely missing score, never a phantom 0-0.
  const showScore = fixture.status === 'live' || fixture.status === 'ft';
  return (
    <header className="mb-8 rise-in rise-in-1">
      {[fixture.home, fixture.away].map(side => (
        <div key={side.teamId} className="flex items-center gap-3 py-1.5">
          <Link to={`/team/${comp.id}/${side.teamId}`}
            className="flex items-center gap-3 flex-1 min-w-0">
            <Crest side={side} size={26} />
            <span className="text-[19px] truncate">{side.name}</span>
          </Link>
          <span className="text-[30px] tabular-nums">
            {showScore && side.score != null ? side.score : '–'}
          </span>
        </div>
      ))}
      <div className="mt-2 flex items-center gap-2.5">
        <StatusWord fixture={fixture} />
        <TvBadge tv={fixture.tv} />
      </div>
      {pens && (
        <p className="font-sans text-[10px] text-accent mt-1">
          {pens.winnerName} win {pens.winnerScore}–{pens.loserScore} on penalties
        </p>
      )}
      {/* The tie's verdict (spec §13.29): the same accent recipe as the
          shootout line — the truth of the TIE beside the score of the LEG,
          because a won leg must never read as a won tie. */}
      {tie && (
        <p className="font-sans text-[10px] text-accent mt-1">
          {tie.level
            ? `${tie.winnerName} through — ${tie.winnerAgg}–${tie.loserAgg} on aggregate`
            : `${tie.winnerName} through ${tie.winnerAgg}–${tie.loserAgg} on aggregate`}
        </p>
      )}
      <MetadataLine fixture={fixture} gameInfo={gameInfo} />
      {/* The other leg, one tap away (spec §13.29): its label and score in
          the meeting-ledger's muted recipes, linking to that leg's page.
          PLAYED legs only (user report, 2026-08-20): a scheduled return
          leg carries ESPN's phantom score:"0" both sides, and "2nd leg
          0–0" reads as a finished goalless game. No line beats a lie. */}
      {otherLeg && otherLeg.status === 'ft' && (
        <Link data-testid="leg-link" to={`/match/${comp.id}/${otherLeg.id}`}
          className="flex items-center gap-2.5 mt-2">
          <span className="font-sans text-[9px] uppercase tracking-[.14em] text-muted">
            {legLabel(otherLeg.leg)}
          </span>
          <span className="flex items-center gap-2 text-[13px] tabular-nums">
            <Crest side={otherLeg.home} size={20} />
            {otherLeg.home.score}–{otherLeg.away.score}
            <Crest side={otherLeg.away} size={20} />
          </span>
        </Link>
      )}
      {showScore && Array.isArray(events) && (
        <MatchLine points={timelinePoints(events, fixture)} fixture={fixture} />
      )}
    </header>
  );
}

// Two rows of five W/D/L glyphs — one per side — reusing the league
// table's glyph style. Gated on both sides actually having a guide; a
// lopsided form object (one side only) renders nothing rather than a
// half-empty block.
function FormBlock({ form, fixture }) {
  if (!form) return null;
  const homeForm = form[fixture.home.teamId];
  const awayForm = form[fixture.away.teamId];
  if (!homeForm?.length || !awayForm?.length) return null;
  return (
    <section className="mb-8 rise-in rise-in-2">
      <SectionLabel muted>Form coming in</SectionLabel>
      {[[fixture.home, homeForm], [fixture.away, awayForm]].map(([side, guide]) => (
        <div key={side.teamId} className="flex items-center gap-3 py-1.5">
          <Crest side={side} size={18} />
          <FormGlyphs form={guide} />
        </div>
      ))}
    </section>
  );
}

function TimelineRow({ e, fixture, comp, onOpenPlayer }) {
  const teamSide = sideForTeam(fixture, e.teamId);
  const type = e.type ?? '';
  const isSub = /substitution/i.test(type);
  const isYellow = type === 'Yellow Card';
  const isRed = type === 'Red Card';
  const isPlainGoal = type === 'Goal';

  let content;
  if (e.player == null) {
    // Never a blank row: no player, so the type word carries the moment.
    content = (
      <span className="font-sans text-[9.5px] uppercase tracking-[.12em] text-muted">
        {type}
      </span>
    );
  } else if (isSub) {
    // Only the ON player is tappable — the OFF name (playerOffId) stays
    // plain text, one fewer tap target cluttering a substitution row.
    content = (
      <>
        <PlayerTap name={e.player} playerId={e.playerId} comp={comp} onOpen={onOpenPlayer}
          className="text-[15px]" />
        <span className="text-[15px]">{' ↑'}</span>
        {e.playerOff && (
          <span className="text-[15px] text-muted ml-3">{e.playerOff} ↓</span>
        )}
      </>
    );
  } else if (isPlainGoal) {
    // A plain 'Goal' needs no redundant type word — the bold-ish serif
    // name alone says everything, with no accent colour and no ⚽.
    content = (
      <PlayerTap name={e.player} playerId={e.playerId} comp={comp} onOpen={onOpenPlayer}
        className="text-[15px] font-semibold" />
    );
  } else if (isYellow || isRed) {
    content = (
      <>
        <PlayerTap name={e.player} playerId={e.playerId} comp={comp} onOpen={onOpenPlayer}
          className="text-[15px]" />
        <span className="font-sans text-[9.5px] uppercase tracking-[.12em] text-muted ml-2.5">
          {type}
        </span>
        <span data-testid={isYellow ? 'card-yellow' : 'card-red'}
          className={`inline-block w-2 h-[11px] rounded-sm ml-2.5 align-middle ${
            isYellow ? 'bg-[#E7C24A]' : 'bg-accent'
          }`} />
      </>
    );
  } else {
    // A qualified goal ('Own Goal', 'Penalty', ...) keeps its type word —
    // that's exactly where it adds meaning — same treatment as any other
    // named moment (kickoff subs aside, cards aside).
    content = (
      <>
        <PlayerTap name={e.player} playerId={e.playerId} comp={comp} onOpen={onOpenPlayer}
          className="text-[15px]" />
        <span className="font-sans text-[9.5px] uppercase tracking-[.12em] text-muted ml-2.5">
          {type}
        </span>
      </>
    );
  }

  return (
    <div className="flex items-baseline gap-4 py-3 border-b border-rule/60">
      <span className="w-9 font-sans text-[11px] text-accent tabular-nums shrink-0">
        {e.minute}
      </span>
      <span className="w-4 h-4 shrink-0 self-center inline-flex items-center">
        {teamSide && <Crest side={teamSide} size={16} />}
      </span>
      <div className="flex-1 min-w-0">{content}</div>
    </div>
  );
}

function Timeline({ events, fixture, comp, onOpenPlayer }) {
  if (!events?.length) return null;
  return (
    <section className="mb-8 rise-in rise-in-3">
      <SectionLabel>The match</SectionLabel>
      {[...events].reverse().map((e, i) => (
        <TimelineRow key={i} e={e} fixture={fixture} comp={comp} onOpenPlayer={onOpenPlayer} />
      ))}
    </section>
  );
}

// The home side's share of a two-club count as a percentage (spec §13.24,
// the split rule) — exported for direct unit-testing. ESPN team stats
// arrive as strings; a both-zero or unparseable pair yields null so the
// row keeps its plain hairline (no story, no split) instead of painting
// a meaningless 50/50.
export function statSplit(homeVal, awayVal) {
  // Number('') is 0 — an empty displayValue must read as UNKNOWN, not as a
  // measured zero, or a blank home cell would paint a confident 100%-away
  // split (review round). Junk like '54%' parses NaN and falls out below.
  const num = v => (String(v ?? '').trim() === '' ? NaN : Number(v));
  const h = num(homeVal);
  const a = num(awayVal);
  if (!Number.isFinite(h) || !Number.isFinite(a) || h + a === 0) return null;
  return (h / (h + a)) * 100;
}

// The split rule (spec §13.24, S-A "the tinted rule"): the row's hairline
// carrying both clubs' shares — home colour from the left, away from the
// right, meeting at a 1px ink tick (the match line's tick, at hairline
// scale). Sides without a feed colour fall back to muted, the goal dots'
// own rule. The tick is the ink-boundary idiom where the Shirt.jsx outline
// physically cannot fit: a white-kitted share (Fulham-class ffffff) reads
// as the bounded blank between tick and coloured edge, never as nothing.
// tall = the possession bar's 3px weight on an 8px strip.
function SplitRule({ pct, fixture, tall }) {
  // overflow-hidden keeps the edge ticks (0% and shutout 100%) inside the
  // strip; bg-rule under the segments restores the old possession bar's
  // neutral track, so a pale-vs-pale pairing (two white-kitted clubs) still
  // reads as a bar rather than vanishing into the paper (review round).
  return (
    <div data-testid="split-rule" className={`relative overflow-hidden ${tall ? 'h-[8px]' : 'h-[6px]'}`}>
      <div className={`absolute inset-x-0 flex bg-rule ${tall ? 'top-[2.5px] h-[3px]' : 'top-[2px] h-[2px]'}`}>
        <div data-testid="split-home" className={`h-full ${pressFill(fixture.home).className}`}
          style={{ width: `${pct}%`, ...pressFill(fixture.home).style }} />
        <div data-testid="split-away" className={`h-full flex-1 ${pressFill(fixture.away).className}`}
          style={pressFill(fixture.away).style} />
      </div>
      <span data-testid="split-tick" style={{ left: `${pct}%` }}
        className="absolute inset-y-0 w-px bg-ink/60 -translate-x-1/2" />
    </div>
  );
}

function Stats({ teamStats, fixture }) {
  if (!teamStats) return null;
  // Strict id match only (review round): the old positional [0]/[1] fallback
  // was survivable when the bars were neutral ink, but the split rules paint
  // CLUB COLOURS — a mis-ordered fallback would tint the away team's share
  // in the home club's colour. No match, no section; never a misattribution.
  const h = teamStats.find(t => t.teamId === fixture.home.teamId);
  const a = teamStats.find(t => t.teamId === fixture.away.teamId);
  if (!h || !a || h === a) return null;
  const keys = Object.keys(STAT_LABELS).filter(k => h.stats[k] != null && a.stats[k] != null);
  if (!keys.length) return null;
  // Possession rides the SAME guard as every stat row: a both-zero, blank
  // or unparseable pair renders no bar at all rather than a fabricated
  // share for a side that reported nothing (review round).
  const possession = statSplit(h.stats.possessionPct, a.stats.possessionPct);
  return (
    <section className="mb-8 rise-in rise-in-4">
      <SectionLabel muted>Stats</SectionLabel>
      {possession != null && (
        <div className="mb-5">
          <div className="flex justify-between font-sans text-[11px] mb-1.5">
            <span className="tabular-nums">{h.stats.possessionPct}%</span>
            <span className="text-muted uppercase text-[9px] tracking-[.14em] pt-0.5">Possession</span>
            <span className="tabular-nums">{a.stats.possessionPct}%</span>
          </div>
          <SplitRule pct={possession} fixture={fixture} tall />
        </div>
      )}
      {keys.filter(k => k !== 'possessionPct').map(k => {
        const pct = statSplit(h.stats[k], a.stats[k]);
        return (
          <div key={k} className={`pt-2 font-sans text-[12px] ${
            pct == null ? 'border-b border-rule/60' : ''}`}>
            <div className="flex justify-between pb-2">
              <span className="tabular-nums w-8">{h.stats[k]}</span>
              <span className="text-muted uppercase text-[9px] tracking-[.14em] pt-0.5">
                {STAT_LABELS[k]}
              </span>
              <span className="tabular-nums w-8 text-right">{a.stats[k]}</span>
            </div>
            {pct != null && <SplitRule pct={pct} fixture={fixture} />}
          </div>
        );
      })}
    </section>
  );
}

// Post-match standout performers per side — up to three quiet
// "label: player value" rows. Gated on full time explicitly, not just on
// data presence: ESPN's leaders endpoint publishes season-to-date numbers
// even for a fixture that hasn't kicked off yet, which would mislead if
// shown as if they were "this match's" standouts.
function Standouts({ standouts, fixture, comp, onOpenPlayer }) {
  if (fixture.status !== 'ft' || !standouts?.length) return null;
  return (
    <section className="mb-8 rise-in rise-in-5">
      <SectionLabel muted>Standouts</SectionLabel>
      {standouts.map(s => (
        <div key={s.teamId ?? s.teamName} className="mb-4 last:mb-0">
          <p className="font-sans text-[10px] uppercase tracking-[.14em] text-muted mb-2">
            {s.teamName}
          </p>
          {s.entries.slice(0, 3).map((en, i) => (
            <p key={i} className="text-[13px] text-muted">
              {/* Bare-text interpolation when not tappable (no playerId, or a
                  BBC comp) keeps this exactly the single text node it always
                  was; only the tappable case introduces a nested <button>. */}
              {en.label}: {canTapPlayer(comp, en.playerId)
                ? <button type="button" onClick={() => onOpenPlayer(en.playerId)}>{en.player}</button>
                : en.player} {en.value}
            </p>
          ))}
        </div>
      ))}
    </section>
  );
}

// One XI, one half (spec §13.25): the club sub-label then every starter —
// all eleven always, never an accordion — Shirt beside a single-line name
// that truncates with an ellipsis rather than wrapping. The tap is how a
// clipped name reaches its full player, so PlayerTap stays on every name.
function LineupColumn({ side, players, comp, onOpenPlayer, testId }) {
  return (
    <div data-testid={testId} className="min-w-0">
      <p className="font-sans text-[10px] uppercase tracking-[.14em] text-muted mb-2 truncate">
        {side.name}
      </p>
      {/* One published XI without the other (normal pre-kick-off state):
          the empty side says so in one line, never a blank half-section. */}
      {players.length === 0 && (
        <p className="font-sans text-[11px] text-muted">XI not yet published.</p>
      )}
      {players.map(p => (
        <div key={p.id ?? p.name} className="flex items-center gap-2.5 py-1.5 min-w-0">
          <Shirt colour={side.colour ?? null} number={p.shirt} size={20} />
          <PlayerTap name={p.name} playerId={p.id} comp={comp} onOpen={onOpenPlayer}
            className="text-[13px] truncate min-w-0 flex-1 text-left" />
        </div>
      ))}
    </div>
  );
}

// The lineups take the field (spec §13.25, L-B "the centre circle alone"):
// home keeps the left column — found by homeAway, never by feed array
// order — and the two XIs meet at one drawn mark: the half-way line
// running the gutter, opening into the centre circle at mid-height. The
// mark is decoration, not structure: rule tone at 65%, softer than the
// section's true hairlines, aria-hidden and inert. A circle must never
// ride a stretched SVG (it would render as an ellipse), so the line is a
// plain 1px div and the circle a fixed-size svg, centred independently.
function Lineups({ lineups, fixture, comp, onOpenPlayer }) {
  // Attribution is by homeAway ONLY (spec §13.25's own law, hardened in the
  // review round): an entry the feed doesn't identify is never guessed into
  // a column — a mislabelled XI under the wrong club's name and colours is
  // worse than no section. The gate counts STARTERS, not roster presence,
  // so a subs-only pre-announcement roster renders nothing rather than two
  // labelled empty columns under a floating centre circle.
  const starters = ha =>
    (lineups?.find(l => l.homeAway === ha)?.players ?? []).filter(p => p.starter);
  const homeXI = starters('home');
  const awayXI = starters('away');
  if (!homeXI.length && !awayXI.length) return null;
  return (
    <section className="mb-8 rise-in rise-in-5">
      <SectionLabel muted>Lineups</SectionLabel>
      {/* overflow-hidden: a short column set (partial pre-match feed) must
          clip the 190px circle, never bleed it over neighbouring sections. */}
      <div className="relative overflow-hidden">
        <div data-testid="lineup-pitch" aria-hidden="true"
          className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-rule/65" />
          {/* currentColor under text-rule keeps the mark on the token — a
              future rule retune moves the circle with every other hairline. */}
          <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-rule"
            width="190" height="190" viewBox="0 0 190 190">
            <circle cx="95" cy="95" r="93" fill="none" stroke="currentColor" strokeOpacity=".65" />
            <circle cx="95" cy="95" r="1.5" fill="currentColor" fillOpacity=".65" />
          </svg>
        </div>
        <div className="relative grid grid-cols-2 gap-x-4">
          <LineupColumn testId="lineup-col-home" side={fixture.home} players={homeXI}
            comp={comp} onOpenPlayer={onOpenPlayer} />
          <LineupColumn testId="lineup-col-away" side={fixture.away} players={awayXI}
            comp={comp} onOpenPlayer={onOpenPlayer} />
        </div>
      </div>
    </section>
  );
}

// Prior meetings between these two sides — rendered pre-match too, since
// history doesn't need kickoff to have happened.
// The match page's head-to-head speaks the drawer's language (spec §13.26):
// the same MeetingRow ledger and the same balance, imported from the
// drawer's own module rather than re-drawn. Two surface-appropriate
// depths, deliberately kept: the drawer glances at the last three; this
// page is the deep view — ALL meetings the feed carries, most recent
// first (sorted here, seasonseries order isn't guaranteed), the balance
// struck over everything shown.
function HeadToHead({ headToHead, fixture }) {
  if (!headToHead?.meetings?.length) return null;
  const meetings = [...headToHead.meetings]
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const { homeWins, draws, awayWins } = meetingBalance(meetings, fixture);
  return (
    <section className="mb-8 rise-in rise-in-5">
      <SectionLabel muted>Head to head</SectionLabel>
      {headToHead.summary && (
        <p className="font-sans text-[10px] text-muted mb-3">{headToHead.summary}</p>
      )}
      <div className="mb-1">
        {meetings.map((m, i) => <MeetingRow key={i} meeting={m} fixture={fixture} />)}
      </div>
      <BalanceBar homeWins={homeWins} draws={draws} awayWins={awayWins} fixture={fixture} />
    </section>
  );
}

// Round siblings (spec §13.13), at the very bottom of the room, after
// the video card. Labelled by the same grouping siblingFixtures() itself
// used — 'In this round' for a knockout/group tie, 'That day' for a
// league fixture (whose round carries the season name, not a round).
// Absent entirely rather than an empty shelf when there are none.
function Siblings({ siblings, fixture, followedIds }) {
  if (!siblings?.length) return null;
  return (
    <section className="mb-8 rise-in rise-in-5">
      {/* Same discriminator as siblingFixtures (2026-08-20 fix): a league's
          season-slug round is not a round — those siblings are "That day". */}
      <SectionLabel muted>{prettifyRound(fixture.round) != null ? 'In this round' : 'That day'}</SectionLabel>
      {siblings.map(f => (
        <FixtureRow key={f.id} fixture={f} showContext={false} followedIds={followedIds} />
      ))}
    </section>
  );
}

export default function MatchRoom({ fixture, comp, detail, videos, siblings, otherLeg = null,
  followedIds = new Set() }) {
  // The peek sheet's open/closed player (spec §13.16) — one instance lives
  // at the room's root rather than per tap-site, so standouts, lineups and
  // timeline names all share the same sheet instead of each mounting one.
  const [sheetPlayerId, setSheetPlayerId] = useState(null);
  const headerFixture = fixture.status === 'live'
    ? withLiveScore(fixture, detail?.liveScore)
    : fixture;
  const round = prettifyRound(fixture.round);
  return (
    <main>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-muted">
        <Link to={`/competition/${comp.id}`}>{comp.name}</Link>{round && ` · ${round}`}
        {fixture.leg != null && ` · ${legLabel(fixture.leg)}`}
      </p>
      <p className="text-[12px] text-muted mb-5">{fullDate(fixture.kickoff)}</p>
      <ScoreHeader fixture={headerFixture} comp={comp} gameInfo={detail?.gameInfo}
        events={detail?.events} otherLeg={otherLeg} />
      {comp.hasMatchDetail
        ? (<>
            <FormBlock form={detail?.form} fixture={fixture} />
            <Timeline events={detail?.events} fixture={fixture} comp={comp} onOpenPlayer={setSheetPlayerId} />
            <Stats teamStats={detail?.teamStats} fixture={fixture} />
            <Standouts standouts={detail?.standouts} fixture={fixture} comp={comp} onOpenPlayer={setSheetPlayerId} />
            <Lineups lineups={detail?.lineups} fixture={fixture} comp={comp} onOpenPlayer={setSheetPlayerId} />
            <HeadToHead headToHead={detail?.headToHead} fixture={fixture} />
          </>)
        : (
          <p className="font-sans text-[11px] text-muted">
            Detailed stats aren't published for {comp.name}.
          </p>
        )}
      {/* Gated on status ft + data only (spec §13.9) — never on
          comp.hasMatchDetail, so a BBC-degraded fixture that finished can
          still surface highlights even with no match detail to show. */}
      <VideoCard videos={videos} />
      <Siblings siblings={siblings} fixture={fixture} followedIds={followedIds} />
      <PlayerSheet comp={comp} playerId={sheetPlayerId} onClose={() => setSheetPlayerId(null)} />
    </main>
  );
}
