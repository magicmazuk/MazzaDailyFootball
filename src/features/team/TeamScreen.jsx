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
import PlayerSheet from '../player/PlayerSheet.jsx';
import { teamFixtures, phaseReplayGroups } from './teamFixtures.js';

const WATERMARK_OPACITY = 0.10; // the dial — user may want it stronger/weaker
const roundLabelFor = round => prettifyRound(round) ?? fallbackRoundLabel(round) ?? round;

// The visual squad experiment (squad-visual branch, Aug 2026): pitch-order
// position buckets for the programme grid + balance strip. p.position is
// either a full name ("Goalkeeper") or an ESPN abbreviation ("G") — both
// shapes match on first letter, so one regex per bucket covers both.
// Anything matching none (null, unrecognised positions) falls into a
// trailing 'Squad' bucket, appended after Forwards.
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

// The balance strip (experiment brief §1): a hand-authored pitch schematic
// — outer rect, halfway line, two penalty boxes, no path data — with
// GK/DEF/MID/FWD zones shaded in alternating `drawer` opacity and sized
// proportionally to their counts. role="img" carries the numerals as an
// accessible text alternative (role="img" prunes descendant content from
// the accessibility tree, so the visual overlay needs no separate
// aria-hidden).
function BalanceStrip({ counts }) {
  const labels = ['GK', 'DEF', 'MID', 'FWD'];
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  const zones = counts.map((count, i) => {
    const width = (count / total) * 400;
    const zone = { label: labels[i], count, x: cursor, width };
    cursor += width;
    return zone;
  });
  return (
    <div className="relative mb-8" role="img" aria-label={`Squad balance ${counts.join(' · ')}`}>
      <svg viewBox="0 0 400 64" preserveAspectRatio="none" width="100%" height="64">
        {zones.map((z, i) => (
          <rect key={z.label} x={z.x} y="0" width={z.width} height="64"
            fill="currentColor" className="text-drawer" opacity={i % 2 === 0 ? 1 : 0.5} />
        ))}
        <rect x="1" y="1" width="398" height="62" fill="none" stroke="currentColor"
          strokeWidth="1" className="text-ink" />
        <line x1="200" y1="1" x2="200" y2="63" stroke="currentColor" strokeWidth="1" className="text-ink" />
        <rect x="1" y="15" width="42" height="34" fill="none" stroke="currentColor"
          strokeWidth="1" className="text-ink" />
        <rect x="357" y="15" width="42" height="34" fill="none" stroke="currentColor"
          strokeWidth="1" className="text-ink" />
      </svg>
      <div className="absolute inset-0 flex">
        {zones.map(z => (
          <div key={z.label} style={{ flexGrow: Math.max(z.count, 0.4), flexBasis: 0 }}
            className="flex flex-col items-center justify-center">
            <span className="font-serif text-[15px] tabular-nums leading-none">{z.count}</span>
            <span className="font-sans text-[7px] uppercase tracking-[.14em] text-muted mt-0.5">{z.label}</span>
          </div>
        ))}
      </div>
    </div>
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
  const squadCounts = squadGroups ? squadGroups.slice(0, 4).map(g => g.players.length) : null;

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
              <BalanceStrip counts={squadCounts} />
              {squadGroups.filter(g => g.players.length > 0).map(g => (
                <div key={g.key} className="mb-6 last:mb-0">
                  <p data-testid={`squad-group-${g.key}`}
                    className="font-sans text-[9.5px] uppercase tracking-[.18em] text-muted mb-2">
                    {g.sectionLabel}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {g.players.map(p => (
                      <button key={p.id} type="button" onClick={() => setSheetPlayerId(p.id)}
                        aria-label={`${p.name}`}
                        className="border border-rule rounded-[2px] p-3.5 text-center bg-paper">
                        <div className="font-serif text-[30px] tabular-nums leading-none">
                          {p.shirt ?? '—'}
                        </div>
                        <div className="font-sans text-[9.5px] mt-2 line-clamp-2">{p.name}</div>
                      </button>
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
