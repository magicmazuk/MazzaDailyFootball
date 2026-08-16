import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COMPETITIONS, byId } from '../../domain/competitions.js';
import { formGuide } from '../../domain/form.js';
import { prettifyRound } from '../../domain/round.js';
import { fallbackRoundLabel } from '../../domain/field.js';
import { useAllSeasonFixtures, useSquad, useTeams } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import Crest from '../../ui/Crest.jsx';
import FixtureRow from '../../ui/FixtureRow.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import CalendarGlyph from '../../ui/CalendarGlyph.jsx';
import Shirt from '../../ui/Shirt.jsx';
import PlayerSheet from '../player/PlayerSheet.jsx';
import { teamFixtures, phaseReplayGroups } from './teamFixtures.js';

const WATERMARK_OPACITY = 0.10; // the dial — user may want it stronger/weaker
const roundLabelFor = round => prettifyRound(round) ?? fallbackRoundLabel(round) ?? round;

// The visual squad experiment (squad-visual branch, Aug 2026, v2 — replaces
// v1's balance strip + programme grid with quiet rows of club-coloured
// shirt icons). p.position is either a full name ("Goalkeeper") or an ESPN
// abbreviation ("G") — both shapes match on first letter, so one regex per
// bucket covers both. Anything matching none (null, unrecognised positions)
// falls into a trailing 'Squad' bucket, appended after Forwards. Each
// bucket's own `label` (GK/DEF/MID/FWD/SQD) doubles as the per-row position
// abbrev on the right of every row in that section.
const POSITION_BUCKETS = [
  { key: 'gk', label: 'GK', sectionLabel: 'Goalkeepers', match: /^g/i },
  { key: 'def', label: 'DEF', sectionLabel: 'Defenders', match: /^d/i },
  { key: 'mid', label: 'MID', sectionLabel: 'Midfielders', match: /^m/i },
  { key: 'fwd', label: 'FWD', sectionLabel: 'Forwards', match: /^f/i },
];

function groupSquad(players) {
  const buckets = POSITION_BUCKETS.map(b => ({ ...b, players: [] }));
  const leftover = { key: 'squad', label: 'SQD', sectionLabel: 'Squad', players: [] };
  for (const p of players) {
    const bucket = buckets.find(b => b.match.test(p.position ?? ''));
    (bucket ?? leftover).players.push(p);
  }
  return [...buckets, leftover];
}

// A squad row (replacing v1's number tile): shirt icon, name, position
// abbrev — a button opening the existing PlayerSheet, same wiring as v1.
function SquadRow({ player, colour, positionAbbrev, onOpen }) {
  return (
    <button type="button" onClick={onOpen} aria-label={player.name}
      className="w-full flex items-center gap-3 py-2 border-b border-rule/60 text-left">
      <Shirt colour={colour} number={player.shirt} />
      <span className="font-serif text-[14.5px] truncate flex-1">{player.name}</span>
      <span className="font-sans text-[10px] uppercase tracking-[.14em] text-muted shrink-0">
        {positionAbbrev}
      </span>
    </button>
  );
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
  const sheetComp = byId(squad.data?.resolvedCompId) ?? comp;
  const squadGroups = comp?.hasSquads && squad.data?.players?.length > 0
    ? groupSquad(squad.data.players) : null;

  const allFixtures = seasons.flatMap(r => r.data?.fixtures ?? []);
  const { all, next, last } = teamFixtures(allFixtures, teamId);
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
    <main className="relative overflow-hidden">
      {team.crestUrl && (
        <div aria-hidden className="pointer-events-none absolute -top-[140px] -right-[140px]
                                    w-[420px] h-[420px] bg-no-repeat bg-contain"
          style={{ backgroundImage: `url(${team.crestUrl})`, opacity: WATERMARK_OPACITY }} />
      )}
      <div className="relative">
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
          <FixtureRow fixture={next} followedIds={followedIds} />
        </section>)}
        {last && (<section className="mb-8">
          <SectionLabel muted>Last</SectionLabel>
          <FixtureRow fixture={last} followedIds={followedIds} />
        </section>)}

        <section className="mb-8">
          <SectionLabel muted>Squad</SectionLabel>
          {comp?.hasSquads === false && (
            <p className="font-sans text-[11px] text-muted">
              Squad details aren't published for {comp.name}.
            </p>
          )}
          {squadGroups && (
            <div>
              {squadGroups.filter(g => g.players.length > 0).map(g => (
                <div key={g.key} className="mb-6 last:mb-0">
                  <p data-testid={`squad-group-${g.key}`}
                    className="font-sans text-[9.5px] uppercase tracking-[.18em] text-muted mb-2">
                    {g.sectionLabel}
                  </p>
                  <div>
                    {g.players.map(p => (
                      <SquadRow key={p.id} player={p} colour={team.colour} positionAbbrev={g.label}
                        onOpen={() => setSheetPlayerId(p.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
