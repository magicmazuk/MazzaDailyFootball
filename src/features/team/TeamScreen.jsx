import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COMPETITIONS, byId } from '../../domain/competitions.js';
import { formGuide } from '../../domain/form.js';
import { prettifyRound } from '../../domain/round.js';
import { fallbackRoundLabel } from '../../domain/field.js';
import { useAllSeasonFixtures, useMatchDetail, useSquad, useTeams } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import Crest from '../../ui/Crest.jsx';
import FixtureRow from '../../ui/FixtureRow.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import CalendarGlyph from '../../ui/CalendarGlyph.jsx';
import PlayerSheet from '../player/PlayerSheet.jsx';
import SquadBoard from './SquadBoard.jsx';
import { teamFixtures, phaseReplayGroups } from './teamFixtures.js';

const WATERMARK_OPACITY = 0.10; // the dial — user may want it stronger/weaker
const roundLabelFor = round => prettifyRound(round) ?? fallbackRoundLabel(round) ?? round;

// The team sheet (squad-visual branch, Aug 2026, task 3): the squad's
// position-bucket grouping now lives in SquadBoard, which also owns the
// starters-known pitch vs bands fallback. This screen's job is just the
// data step — resolving the last fixture's lineup (when the source
// publishes one) and matching its starters back to squad players by id.
function ourLineup(detail, fixture, teamId) {
  if (!fixture) return null;
  const homeAway = fixture.home.teamId === teamId ? 'home'
    : fixture.away.teamId === teamId ? 'away' : null;
  return detail?.lineups?.find(l => l.homeAway === homeAway) ?? null;
}

// Starters matched back to the squad list by id for their shirt/position
// (lineup entries carry id since R2.6) — but a starter the lineup knows
// about that the squad list doesn't (a summer signing the roster endpoint
// hasn't caught up on yet, or any other id mismatch) is never silently
// dropped off the pitch. It's synthesised straight from the lineup entry
// instead, which already carries id/name/shirt — with no recognisable
// position, so SquadBoard's bucketing lands it in the trailing 'Squad'
// row rather than the XI quietly showing ten shirts.
export function matchStarters(lineupPlayers, squadPlayers) {
  const bySquadId = new Map(squadPlayers.map(p => [p.id, p]));
  return (lineupPlayers ?? [])
    .filter(p => p.starter)
    .map(p => bySquadId.get(p.id) ?? { id: p.id, name: p.name, shirt: p.shirt, position: null });
}

// The scout (spec §13.20): one line above the squad section for a squad
// resolved under a DISCOVERED foreign league (never for the route comp or
// a sco/eng fallback — see useSquad). The full sentence needs wins/played/
// points together; a null or partial record (irreconcilable wins/draws,
// see adaptTeamRecord) falls back to naming just the league — draws/losses
// are never spelled out either way, to keep it one line.
function scoutLine(squadData) {
  if (!squadData?.discovered) return null;
  const { resolvedLeagueName, record } = squadData;
  if (record && record.wins != null && record.played != null && record.points != null) {
    return `Won ${record.wins} of ${record.played} in the ${resolvedLeagueName} this season · ${record.points} points`;
  }
  return `They play in the ${resolvedLeagueName}.`;
}

function FollowButton({ team }) {
  const { follow, unfollow } = usePrefs();
  const followed = usePrefs(s => Boolean(s.followed[team.id]));
  const fixed = team.id === '256';
  return (
    <button type="button" disabled={fixed}
      onClick={() => (followed ? unfollow(team.id) : follow(team))}
      className={`font-sans text-[9.5px] uppercase tracking-[.14em] border rounded-full
        px-4 py-2 ${followed ? 'bg-ink text-paper border-ink' : 'text-ink border-ink'}`}>
      {fixed ? '★ Your club' : followed ? '★ Following' : '☆ Follow'}
    </button>
  );
}

export default function TeamScreen() {
  const { compId, teamId } = useParams();
  const comp = byId(compId);
  const teams = useTeams(comp ?? { id: 'none', source: 'bbc' });
  const seasons = useAllSeasonFixtures(COMPETITIONS);
  const squad = useSquad(comp ?? { id: 'none', hasSquads: false }, teamId);
  // The peek sheet's open/closed player (sheet-first consistency, Aug 2026):
  // every squad-row tap opens PlayerSheet, same one-instance-per-screen
  // pattern as MatchRoom. The sheet needs the resolved comp (home-league
  // hotfix), not the route comp, so its stats fetch and Full profile link
  // keep working when the squad resolved under a fallback league.
  const [sheetPlayerId, setSheetPlayerId] = useState(null);
  // The scout (spec §13.20): a discovered foreign slug (e.g. aut.1) has no
  // registry entry — byId would return undefined and silently fall through
  // to the route comp, breaking the sheet's stats fetch and Full profile
  // link. A minimal synthetic descriptor carries exactly what PlayerSheet/
  // usePlayer read off comp: id (fetch path + Full profile link), source
  // (usePlayer's espn gate) and name (the sheet's system line).
  const sheetComp = squad.data?.discovered
    ? { id: squad.data.resolvedCompId, name: squad.data.resolvedLeagueName, source: 'espn' }
    : byId(squad.data?.resolvedCompId) ?? comp;

  const allFixtures = seasons.flatMap(r => r.data?.fixtures ?? []);
  const { all, next, last } = teamFixtures(allFixtures, teamId);

  // The team sheet's data step (task 3): the last fixture's own competition
  // (not necessarily the route comp — teamFixtures spans every comp) drives
  // the lineup fetch, same summary endpoint the match room already uses.
  // A BBC-degraded comp (hasMatchDetail: false) disables the query the same
  // way MatchScreen disables it for a bbc- event — never a wasted fetch.
  const lastComp = last ? byId(last.compId) : null;
  const lineupComp = lastComp?.hasMatchDetail ? lastComp : { id: 'none', hasMatchDetail: false };
  const matchDetail = useMatchDetail(lineupComp, last?.id, false);
  const lineup = ourLineup(matchDetail.data?.detail, last, teamId);
  // null (not []) when there's no lineup yet — SquadBoard treats that, and
  // only that, as "fall back to the bands".
  const starters = lineup && squad.data?.players
    ? matchStarters(lineup.players, squad.data.players)
    : null;
  const opponentSide = last ? (last.home.teamId === teamId ? last.away : last.home) : null;

  // Replay-the-draw links (spec §13.15): browsable for ANY club with 2+
  // phase-round fixtures in a comp, any seen-state — followed-ness is
  // irrelevant here, unlike the Today invitation.
  const phaseReplayLinks = phaseReplayGroups(all);
  const followedIds = new Set(Object.keys(usePrefs(s => s.followed)));
  // Team identity: teams endpoint when the source has one, else from any fixture.
  const fromFixture = all[0]
    ? (all[0].home.teamId === teamId ? all[0].home : all[0].away) : null;
  const team = teams.data?.teams.find(t => t.id === teamId) ?? fromFixture;

  if (!team) return <p className="text-muted">Loading team…</p>;
  return (
    <main className="relative">
      {team.crestUrl && (
        // Full-bleed watermark (spec §13.18.1): fixed, so it bleeds to the
        // screen edge on mobile instead of clipping at the padded content
        // column — but anchored to the CENTERED COLUMN (max-w-md, matching
        // AppShell), not the raw viewport, so on a wide screen the crest
        // hugs the page like a letterhead rather than floating in the far
        // gutter. At phone widths the column IS the viewport, so the two
        // anchorings are identical there. z-0 keeps it behind the content
        // column (z-10 below), the nav (z-30) and PlayerSheet (z-40/z-50).
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0">
          <div className="max-w-md mx-auto relative">
            <div className="absolute -top-[140px] -right-[140px] w-[420px] h-[420px] bg-no-repeat bg-contain"
              style={{ backgroundImage: `url(${team.crestUrl})`, opacity: WATERMARK_OPACITY }} />
          </div>
        </div>
      )}
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-2">
          <Crest side={team} size={46} />
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] truncate">{team.name}</h1>
          </div>
          <Link to={'/calendar/' + teamId} aria-label={team.name + ' calendar'} className="shrink-0 p-1.5">
            <CalendarGlyph />
          </Link>
          <FollowButton team={{ id: teamId, name: team.name, crestUrl: team.crestUrl ?? null,
            monogram: team.monogram, colour: team.colour ?? null, compId }} />
        </div>
        <p className="font-sans text-[10px] uppercase tracking-[.18em] text-muted mb-8">
          {comp?.name ?? ''}
          {formGuide(allFixtures, teamId).length > 0 &&
            ` · ${formGuide(allFixtures, teamId).join(' ')}`}
        </p>

        {next && (<section className="mb-8">
          <SectionLabel>Next</SectionLabel>
          {/* Keyed on the fixture id (review fix, spec §13.19.1): FixtureRow
              now owns its own `open` drawer state, so without a key React
              would reuse this instance across a refetch that changes which
              fixture is next — an open drawer would silently re-point to a
              different match instead of resetting closed. */}
          <FixtureRow key={next.id} fixture={next} followedIds={followedIds} />
        </section>)}
        {last && (<section className="mb-8">
          <SectionLabel muted>Last</SectionLabel>
          <FixtureRow key={last.id} fixture={last} followedIds={followedIds} />
        </section>)}

        {squad.data?.discovered && (
          <p className="font-serif text-[14.5px] max-w-[60ch] text-ink/70 mb-4">
            {scoutLine(squad.data)}
          </p>
        )}
        <section className="mb-8">
          <SectionLabel muted>Squad</SectionLabel>
          {comp?.hasSquads === false && (
            <p className="font-sans text-[11px] text-muted">
              Squad details aren't published for {comp.name}.
            </p>
          )}
          {comp?.hasSquads && squad.data?.players?.length > 0 && (
            <SquadBoard players={squad.data.players} starters={starters} teamColour={team.colour}
              opponentShortName={opponentSide?.shortName ?? null} onOpenPlayer={setSheetPlayerId} />
          )}
          {/* Resolved (possibly via the domestic-league fallback, spec hotfix Aug 2026) but
              still nothing — distinct from the hasSquads:false "not published" line above. */}
          {comp?.hasSquads && squad.data && squad.data.players.length === 0 && (
            <p className="font-sans text-[11px] text-muted">Squad details unavailable.</p>
          )}
          {comp?.hasSquads && squad.isLoading && <p className="text-muted">Loading squad…</p>}
          {comp?.hasSquads && squad.isError && <p className="font-sans text-[11px] text-muted">Squad unavailable right now.</p>}
        </section>

        <section>
          {phaseReplayLinks.length > 0 ? (
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
              <SectionLabel muted>Season</SectionLabel>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1">
                {phaseReplayLinks.map(g => (
                  <Link key={`${g.compId}:${g.round}`} to={`/draw/${g.compId}/${g.round}/${teamId}`}
                    className="font-sans text-[9.5px] uppercase tracking-[.12em] text-muted">
                    Replay the {roundLabelFor(g.round)} draw
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <SectionLabel muted>Season</SectionLabel>
          )}
          {all.map(f => <FixtureRow key={`${f.compId}-${f.id}`} fixture={f}
            followedIds={followedIds} />)}
        </section>
      </div>
      <PlayerSheet comp={sheetComp} playerId={sheetPlayerId} onClose={() => setSheetPlayerId(null)} />
    </main>
  );
}
