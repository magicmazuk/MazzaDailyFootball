// The fantasy ladder (spec §13.40): FPL points as a ranked quick-table —
// a club's own top ten (team pages) or the whole division's (the EPL
// page). Self-contained like Papers: fetches for itself, owns its
// <section>, and renders NOTHING when the index is missing or predates
// the points trim — absent beats fake zeros. Callers gate mounting to
// eng.1; the data is EPL-only by reality (no ESPN or SPFL fantasy game).
import { useFplIndex } from '../data/queries.js';
import { fplLadder, leagueLadder } from '../domain/fantasy.js';
import SectionLabel from './SectionLabel.jsx';

export default function FantasyLadder({ club = null, league = false }) {
  const index = useFplIndex(true).data ?? null;
  const rows = league ? leagueLadder(index) : fplLadder(index, club);
  if (!rows?.length) return null;
  return (
    <section className="mt-8 mb-8">
      <SectionLabel muted>The fantasy ladder</SectionLabel>
      <div className="mt-2">
        {rows.map((r, i) => (
          <div key={`${r.name}-${i}`}
            className="flex items-baseline gap-2.5 py-1.5 border-b border-rule/70 last:border-b-0">
            <span className="w-4 font-sans text-[10px] text-muted tabular-nums shrink-0">{i + 1}</span>
            <span className="flex-1 min-w-0 truncate text-[13px]">
              {r.name}
              {league && r.club && (
                <span className="font-sans text-[10px] text-muted"> · {r.club}</span>
              )}
            </span>
            {/* This gameweek's points, muted beside the season total. */}
            {r.event != null && (
              <span className="font-sans text-[10px] text-muted tabular-nums shrink-0">+{r.event}</span>
            )}
            <span className="text-[13px] tabular-nums shrink-0">{r.points}</span>
          </div>
        ))}
      </div>
      {/* The source credited, as the dossier credits its plates. */}
      <p className="font-sans text-[8.5px] uppercase tracking-[.14em] text-muted mt-2">
        Source · Fantasy Premier League
      </p>
    </section>
  );
}
