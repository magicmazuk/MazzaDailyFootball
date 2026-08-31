// The Sports Desk (spec §13.49, D-A "the back page"): the landscape
// edition for a propped-up iPad — everything live at once, glanceable
// from across a room, riding the existing 30s live poll. Three columns:
// live matches large with their scorers, the goal wire and the day's
// full-times beside them, the tables and tonight's viewing at the right.
// Zero new fetches; /desk is the bookmark.
import { byId, COMPETITIONS } from '../../domain/competitions.js';
import { useTable, useTodayWindows, useUpcomingBroadcasts } from '../../data/queries.js';
import { usePrefs } from '../../store/prefs.js';
import { tonightsAirtime } from '../../domain/edition.js';
import { surnameOf } from '../../ui/FixtureRow.jsx';
import GoalWire from '../today/GoalWire.jsx';

const prime = m => (m ?? '').replace(/'/g, '′');

// "Durán 4′, Kenny 58′ — Ross 51′": home scorers, an em dash, away's.
function scorerLine(f) {
  const side = teamId => (f.goals ?? [])
    .filter(g => g.teamId === teamId)
    .map(g => `${g.scorer ? `${surnameOf(g.scorer)} ` : ''}${prime(g.minute)}`)
    .join(', ');
  const h = side(f.home.teamId);
  const a = side(f.away.teamId);
  if (!h && !a) return null;
  return [h, a].filter(Boolean).join(' — ');
}

function LiveCard({ f }) {
  const comp = byId(f.compId);
  const scorers = scorerLine(f);
  return (
    <div data-testid="desk-live" className="border-b border-rule py-2.5">
      <p className="font-sans text-[8.5px] uppercase tracking-[.16em] text-muted">
        {comp?.shortName}{f.minute && <span className="text-accent"> · ● {prime(String(f.minute))}</span>}
      </p>
      {[f.home, f.away].map(s => (
        <div key={s.teamId} className="flex items-baseline justify-between py-0.5">
          <span className="text-[17px] truncate min-w-0">{s.name}</span>
          <span className="text-[19px] tabular-nums shrink-0">{s.score ?? '–'}</span>
        </div>
      ))}
      {scorers && (
        <p className="font-sans text-[8.5px] text-muted tabular-nums mt-0.5">{scorers}</p>
      )}
    </div>
  );
}

const Rulehead = ({ children }) => (
  <p className="font-sans text-[9px] uppercase tracking-[.18em] text-muted border-b border-ink pb-1 mb-2">
    {children}
  </p>
);

export default function DeskScreen() {
  const hidden = usePrefs(s => s.hiddenComps);
  const comps = COMPETITIONS.filter(c => !hidden.includes(c.id));
  const windows = useTodayWindows(comps);
  const spl = useTable(byId('sco.1'));
  const epl = useTable(byId('eng.1'));
  const broadcasts = useUpcomingBroadcasts();

  const todays = comps.flatMap((comp, i) =>
    (windows[i]?.data?.fixtures ?? []).map(f => ({ ...f, compId: comp.id })));
  const now = new Date();
  const isToday = f => new Date(f.kickoff).toDateString() === now.toDateString();
  const live = todays.filter(f => f.status === 'live');
  const ftToday = todays.filter(f => f.status === 'ft' && isToday(f));

  const airings = tonightsAirtime(broadcasts, now);
  const seen = new Set();
  const foot = airings?.filter(a => !seen.has(a.show) && seen.add(a.show)) ?? null;

  const tableCol = (comp, rows) => rows?.length > 0 && (
    <div key={comp.id} className="mb-4">
      <p className="font-sans text-[8.5px] uppercase tracking-[.16em] text-muted mb-1">{comp.shortName}</p>
      {rows.slice(0, 4).map(r => (
        <div key={r.teamId} className="flex items-baseline gap-2 py-0.5 text-[12px]">
          <span className="w-3.5 font-sans text-[8.5px] text-muted tabular-nums">{r.position}</span>
          <span className="flex-1 min-w-0 truncate">{r.name}</span>
          <span className="tabular-nums">{r.points}</span>
        </div>
      ))}
    </div>
  );

  return (
    <main>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-accent">
        The Sports Desk
        {live.length > 0 && <span> · ● {live.length} in play</span>}
      </p>
      <h1 className="text-[23px] mb-5">
        {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h1>
      <div className="grid gap-x-7 gap-y-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <section className="rise-in rise-in-1">
          <Rulehead>Live</Rulehead>
          {live.length === 0 && (
            <p className="font-sans text-[11px] text-muted">Nothing in play.</p>
          )}
          {live.map(f => <LiveCard key={`${f.compId}-${f.id}`} f={f} />)}
        </section>
        <section className="rise-in rise-in-2">
          <Rulehead>The goal wire</Rulehead>
          <GoalWire fixtures={live} mode="stack" />
          {live.length > 0 && (live.every(f => !(f.goals?.length))) && (
            <p className="font-sans text-[11px] text-muted">No goals yet.</p>
          )}
          <div className="mt-6">
            <Rulehead>Full time</Rulehead>
            {ftToday.length === 0 && (
              <p className="font-sans text-[11px] text-muted">Nothing settled yet.</p>
            )}
            {ftToday.map(f => (
              <div key={`${f.compId}-${f.id}`}
                className="flex items-baseline gap-2 py-1 text-[12.5px] border-b border-rule/60">
                <span className="flex-1 min-w-0 truncate">{f.home.name}</span>
                <span className="tabular-nums">{f.home.score}</span>
                <span className="flex-1 min-w-0 truncate">{f.away.name}</span>
                <span className="tabular-nums">{f.away.score}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rise-in rise-in-3">
          <Rulehead>As it stands</Rulehead>
          {tableCol(byId('sco.1'), spl.data?.rows)}
          {tableCol(byId('eng.1'), epl.data?.rows)}
          {foot != null && foot.length > 0 && (
            <p className="font-sans text-[8.5px] uppercase tracking-[.14em] text-muted border-t border-rule pt-2 mt-2">
              Tonight — {foot.map(a => [a.show, a.timeLabel, a.channel].filter(Boolean).join(' · ')).join(' / ')}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
