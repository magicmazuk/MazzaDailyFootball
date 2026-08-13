// The match room (spec §7.6): score and clock, then a vertical timeline
// of moments newest first, then stats. Degrades to a clean scoreline
// plus one honest line where the source publishes no detail.
import Crest from '../../ui/Crest.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import StatusWord from '../../ui/StatusWord.jsx';

const STAT_LABELS = {
  possessionPct: 'Possession', totalShots: 'Shots', shotsOnTarget: 'On target',
  wonCorners: 'Corners', foulsCommitted: 'Fouls', yellowCards: 'Yellow cards',
  redCards: 'Red cards', offsides: 'Offsides', saves: 'Saves',
};

function ScoreHeader({ fixture }) {
  return (
    <header className="mb-8">
      {[fixture.home, fixture.away].map(side => (
        <div key={side.teamId} className="flex items-center gap-3 py-1.5">
          <Crest side={side} size={26} />
          <span className="flex-1 text-[19px] truncate">{side.name}</span>
          <span className="text-[30px] tabular-nums">{side.score ?? '–'}</span>
        </div>
      ))}
      <div className="mt-2"><StatusWord fixture={fixture} /></div>
      {fixture.venue && (
        <p className="font-sans text-[10px] text-muted mt-1.5">{fixture.venue}</p>
      )}
    </header>
  );
}

function Timeline({ events }) {
  if (!events?.length) return null;
  return (
    <section className="mb-8">
      <SectionLabel>The match</SectionLabel>
      {[...events].reverse().map((e, i) => (
        <div key={i} className="flex items-baseline gap-4 py-3 border-b border-rule/60">
          <span className="w-9 font-sans text-[11px] text-accent tabular-nums shrink-0">
            {e.minute}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-[15px]">{e.player ?? '—'}</span>
            <span className="font-sans text-[9.5px] uppercase tracking-[.12em] text-muted ml-2.5">
              {e.type}
            </span>
          </div>
        </div>
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
    <section className="mb-8">
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

function Lineups({ lineups, fixture }) {
  if (!lineups?.some(l => l.players.length)) return null;
  const title = ha => (ha === 'home' ? fixture.home.name : fixture.away.name);
  return (
    <section className="mb-8">
      <SectionLabel muted>Lineups</SectionLabel>
      {lineups.map(l => (
        <div key={l.homeAway} className="mb-5">
          <p className="font-sans text-[10px] uppercase tracking-[.14em] text-muted mb-2">
            {title(l.homeAway)}
          </p>
          {l.players.filter(p => p.starter).map(p => (
            <div key={p.name} className="flex items-baseline gap-3 py-1.5">
              <span className="w-6 font-sans text-[11px] text-muted tabular-nums text-right">
                {p.shirt ?? ''}
              </span>
              <span className="text-[14px]">{p.name}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

export default function MatchRoom({ fixture, comp, detail }) {
  return (
    <main>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-muted mb-5">
        {comp.name}
      </p>
      <ScoreHeader fixture={fixture} />
      {comp.hasMatchDetail
        ? (<>
            <Timeline events={detail?.events} />
            <Stats teamStats={detail?.teamStats} fixture={fixture} />
            <Lineups lineups={detail?.lineups} fixture={fixture} />
          </>)
        : (
          <p className="font-sans text-[11px] text-muted">
            Detailed stats aren't published for {comp.name}.
          </p>
        )}
    </main>
  );
}
