// The match room (spec §7.6, §13.8): kicker and date, score and clock,
// venue/attendance/referee, form coming in, a vertical timeline of moments
// newest first, then stats, standouts, lineups and head-to-head. Degrades
// to a clean scoreline plus one honest line where the source publishes no
// detail.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Crest from '../../ui/Crest.jsx';
import FixtureRow, { MatchLine, timelinePoints } from '../../ui/FixtureRow.jsx';
import FormGlyphs from '../../ui/FormGlyphs.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import Shirt from '../../ui/Shirt.jsx';
import StatusWord from '../../ui/StatusWord.jsx';
import TvBadge from '../../ui/TvBadge.jsx';
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

function ScoreHeader({ fixture, comp, gameInfo, events }) {
  const pens = penaltyResult(fixture);
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
      <MetadataLine fixture={fixture} gameInfo={gameInfo} />
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

function Stats({ teamStats, fixture }) {
  if (!teamStats) return null;
  const h = teamStats.find(t => t.teamId === fixture.home.teamId) ?? teamStats[0];
  const a = teamStats.find(t => t.teamId === fixture.away.teamId) ?? teamStats[1];
  if (!h || !a || h === a) return null;
  const keys = Object.keys(STAT_LABELS).filter(k => h.stats[k] != null && a.stats[k] != null);
  if (!keys.length) return null;
  const hp = Number(h.stats.possessionPct ?? 50);
  return (
    <section className="mb-8 rise-in rise-in-4">
      <SectionLabel muted>Stats</SectionLabel>
      {h.stats.possessionPct != null && (
        <div className="mb-5">
          <div className="flex justify-between font-sans text-[11px] mb-1.5">
            <span className="tabular-nums">{h.stats.possessionPct}%</span>
            <span className="text-muted uppercase text-[9px] tracking-[.14em] pt-0.5">Possession</span>
            <span className="tabular-nums">{a.stats.possessionPct}%</span>
          </div>
          <div className="h-[3px] bg-rule rounded-sm overflow-hidden">
            <i className="block h-full bg-ink" style={{ width: `${hp}%` }} />
          </div>
        </div>
      )}
      {keys.filter(k => k !== 'possessionPct').map(k => (
        <div key={k} className="flex justify-between py-2 border-b border-rule/60
                                font-sans text-[12px]">
          <span className="tabular-nums w-8">{h.stats[k]}</span>
          <span className="text-muted uppercase text-[9px] tracking-[.14em] pt-0.5">
            {STAT_LABELS[k]}
          </span>
          <span className="tabular-nums w-8 text-right">{a.stats[k]}</span>
        </div>
      ))}
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

function Lineups({ lineups, fixture, comp, onOpenPlayer }) {
  if (!lineups?.some(l => l.players.length)) return null;
  const title = ha => (ha === 'home' ? fixture.home.name : fixture.away.name);
  const sideColour = ha => (ha === 'home' ? fixture.home.colour : fixture.away.colour) ?? null;
  return (
    <section className="mb-8 rise-in rise-in-5">
      <SectionLabel muted>Lineups</SectionLabel>
      {lineups.map(l => (
        <div key={l.homeAway} className="mb-5">
          <p className="font-sans text-[10px] uppercase tracking-[.14em] text-muted mb-2">
            {title(l.homeAway)}
          </p>
          {l.players.filter(p => p.starter).map(p => (
            <div key={p.name} className="flex items-center gap-3 py-1.5">
              <Shirt colour={sideColour(l.homeAway)} number={p.shirt} size={22} />
              <PlayerTap name={p.name} playerId={p.id} comp={comp} onOpen={onOpenPlayer}
                className="text-[14px]" />
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

// Prior meetings between these two sides — rendered pre-match too, since
// history doesn't need kickoff to have happened.
function HeadToHead({ headToHead }) {
  if (!headToHead?.meetings?.length) return null;
  return (
    <section className="mb-8 rise-in rise-in-5">
      <SectionLabel muted>Head to head</SectionLabel>
      {headToHead.summary && (
        <p className="font-sans text-[10px] text-muted mb-3">{headToHead.summary}</p>
      )}
      {headToHead.meetings.map((m, i) => (
        <div key={i} className="flex items-baseline gap-4 py-2 border-b border-rule/60">
          <span className="w-20 font-sans text-[10px] text-muted tabular-nums shrink-0">
            {shortDate(m.date)}
          </span>
          <span className="text-[14px] flex-1 min-w-0">
            {m.homeName} {m.homeScore}–{m.awayScore} {m.awayName}
          </span>
        </div>
      ))}
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
      <SectionLabel muted>{fixture.round != null ? 'In this round' : 'That day'}</SectionLabel>
      {siblings.map(f => (
        <FixtureRow key={f.id} fixture={f} showContext={false} followedIds={followedIds} />
      ))}
    </section>
  );
}

export default function MatchRoom({ fixture, comp, detail, videos, siblings, followedIds = new Set() }) {
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
      </p>
      <p className="text-[12px] text-muted mb-5">{fullDate(fixture.kickoff)}</p>
      <ScoreHeader fixture={headerFixture} comp={comp} gameInfo={detail?.gameInfo}
        events={detail?.events} />
      {comp.hasMatchDetail
        ? (<>
            <FormBlock form={detail?.form} fixture={fixture} />
            <Timeline events={detail?.events} fixture={fixture} comp={comp} onOpenPlayer={setSheetPlayerId} />
            <Stats teamStats={detail?.teamStats} fixture={fixture} />
            <Standouts standouts={detail?.standouts} fixture={fixture} comp={comp} onOpenPlayer={setSheetPlayerId} />
            <Lineups lineups={detail?.lineups} fixture={fixture} comp={comp} onOpenPlayer={setSheetPlayerId} />
            <HeadToHead headToHead={detail?.headToHead} />
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
