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
import { teamFixtures, phaseReplayGroups } from './teamFixtures.js';

const WATERMARK_OPACITY = 0.10; // the dial — user may want it stronger/weaker
const roundLabelFor = round => prettifyRound(round) ?? fallbackRoundLabel(round) ?? round;

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
          {comp?.hasSquads && squad.data && (
            <div>
              {squad.data.players.map(p => (
                <div key={p.id} className="flex items-baseline gap-3 py-2 border-b border-rule/60">
                  <span className="w-6 font-sans text-[11px] text-muted tabular-nums text-right">
                    {p.shirt ?? '—'}
                  </span>
                  <span className="flex-1 text-[14.5px] truncate">{p.name}</span>
                  <span className="font-sans text-[10px] uppercase text-muted">{p.position ?? ''}</span>
                </div>
              ))}
            </div>
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
    </main>
  );
}
