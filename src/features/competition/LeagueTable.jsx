// The T1 table (spec §7.3): four permanent columns, tap a row to open
// its full record in a drawer. The split is drawn as a real event.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Collapse from '../../ui/Collapse.jsx';
import Crest from '../../ui/Crest.jsx';
import FormGlyphs from '../../ui/FormGlyphs.jsx';
import { ZONE_META, zoneFor } from './zones.js';

// Table movement (spec §13.16): a quiet glyph beside a club that changed
// rank since the last table snapshot, drawn from the feed's rankChange.
// Absent entirely for 0/null/undefined — never a phantom "no movement" mark.
function RankChange({ rankChange }) {
  if (!rankChange) return null;
  const up = rankChange > 0;
  return (
    <span aria-label={`${up ? 'up' : 'down'} ${Math.abs(rankChange)}`}
      className="font-sans text-[8.5px] tabular-nums ml-1.5"
      style={{ color: up ? '#3E8E7E' : '#A11B1B' }}>
      {up ? '▲' : '▼'}{Math.abs(rankChange)}
    </span>
  );
}

function Drawer({ row, form }) {
  const cells = [
    ['P', row.played], ['W', row.won], ['D', row.drawn],
    ['L', row.lost], ['GF', row.goalsFor], ['GA', row.goalsAgainst],
  ];
  return (
    <div className="bg-drawer px-5 py-4 xfade-in">
      <div className="grid grid-cols-6 gap-x-1 gap-y-2 text-center">
        {cells.map(([k, v]) => (
          <div key={k}>
            <div className="font-sans text-[8.5px] uppercase tracking-[.14em] text-muted">{k}</div>
            <div className="text-[16px] tabular-nums mt-0.5">{v}</div>
          </div>
        ))}
      </div>
      {row.deduction !== 0 && (
        <p className="font-sans text-[10px] text-accent mt-3">
          {Math.abs(row.deduction)}-point deduction applied
        </p>
      )}
      {form?.length > 0 && (
        <div className="flex items-center gap-1.5 mt-4">
          <span className="font-sans text-[8.5px] uppercase tracking-[.14em] text-muted mr-1">Form</span>
          <FormGlyphs form={form} />
        </div>
      )}
      <Link to={`/team/${row.compId ?? ''}/${row.teamId}`}
        className="font-sans text-[9.5px] uppercase tracking-[.14em] text-muted underline
                   underline-offset-4 inline-block mt-4">
        Team page
      </Link>
    </div>
  );
}

// The full print's column set (spec §13.33) — fixed widths so the header
// labels sit exactly over their columns. GD gets the widest cell (a
// possible minus sign); Pts prints a point larger, it is the story.
const FULL_COLS = [
  ['P', 'played', 'w-5'], ['W', 'won', 'w-5'], ['D', 'drawn', 'w-5'],
  ['L', 'lost', 'w-5'], ['GF', 'goalsFor', 'w-6'], ['GA', 'goalsAgainst', 'w-6'],
  ['GD', 'goalDifference', 'w-7'],
];

export default function LeagueTable({ comp, rows, followedIds, formByTeam,
  full = false, onToggleFull = null }) {
  const [openId, setOpenId] = useState(null);
  // Lazy-ONCE mounting (fix round 1, HIGH): a row's Drawer stays mounted
  // once it's been opened, even after openId moves to another row, so its
  // Collapse glides shut around real content — see FixtureRow's fuller
  // comment on the same fix.
  const [everOpenedIds, setEverOpenedIds] = useState(() => new Set());
  const usedZones = [...new Set(rows.map(r => zoneFor(comp, r.position)).filter(Boolean))];
  return (
    <div>
      {/* The Full Table toggle (spec §13.33): the accordion was a phone-
          width compromise, never a philosophy — the broadsheet prints the
          full classified when asked. The team-page-link recipe. */}
      {onToggleFull && (
        <div className="flex justify-end mb-2">
          <button type="button" onClick={onToggleFull}
            className="font-sans text-[9.5px] uppercase tracking-[.14em] text-muted underline
                       underline-offset-4">
            {full ? 'Compact table' : 'Full table'}
          </button>
        </div>
      )}
      {full && (
        <div className="flex items-center gap-1 py-1.5 border-b border-rule">
          <span className="w-0.5 mr-1.5" />
          <span style={{ width: 18 }} className="shrink-0" />
          <span className="flex-1 min-w-0" />
          {FULL_COLS.map(([label, , w]) => (
            <span key={label} className={`${w} shrink-0 text-right font-sans text-[8.5px]
                                          uppercase tracking-[.1em] text-muted`}>{label}</span>
          ))}
          <span className="w-7 shrink-0 text-right font-sans text-[8.5px] uppercase tracking-[.1em] text-muted">Pts</span>
        </div>
      )}
      {rows.map(row => (
        <div key={row.teamId}>
          {comp.splitAfter === row.position - 1 && (
            <div className="flex items-center gap-2.5 my-3.5">
              <i className="flex-1 h-px bg-accent/40" />
              <span className="font-sans text-[9px] uppercase tracking-[.2em] text-accent">
                The split
              </span>
              <i className="flex-1 h-px bg-accent/40" />
            </div>
          )}
          <button type="button"
            onClick={full ? undefined : () => {
              setOpenId(cur => (cur === row.teamId ? null : row.teamId));
              setEverOpenedIds(ids => (ids.has(row.teamId) ? ids : new Set(ids).add(row.teamId)));
            }}
            className={`w-full text-left flex items-center py-3 border-b border-rule/70 ${
              full ? 'gap-1 cursor-default' : 'gap-3'}`}>
            {/* -mr-1 was sized for the compact layout's position number;
                the full print breathes instead (user polish, spec §13.33). */}
            <span data-testid="zone-tick"
              className={`w-0.5 self-stretch rounded-sm ${full ? 'mr-1.5' : '-mr-1'}`}
              style={{ background: ZONE_META[zoneFor(comp, row.position)]?.colour ?? 'transparent' }} />
            {/* The position number rests in the full print (user polish,
                spec §13.33): it crowded the zone tick, and there the order
                plus the tick already tell that story. Compact keeps it. */}
            {!full && (
              <span data-testid="table-pos"
                className="w-5 font-sans text-[12px] text-muted tabular-nums shrink-0">
                {row.position}
              </span>
            )}
            <Crest side={row} size={full ? 18 : 22} />
            {full ? (
              <>
                <span className="flex-1 min-w-0 truncate text-[13px]">
                  {row.name}
                  {followedIds.has(row.teamId) && (
                    <span className="text-accent text-[9px] align-middle ml-1">★</span>
                  )}
                </span>
                {FULL_COLS.map(([label, key, w]) => (
                  <span key={label} className={`${w} shrink-0 text-right font-sans text-[11px]
                                                text-muted tabular-nums`}>{row[key]}</span>
                ))}
                <span className="w-7 shrink-0 text-right text-[13px] tabular-nums">{row.points}</span>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0 truncate text-[15px]">
                  {row.name}
                  {followedIds.has(row.teamId) && (
                    <span className="text-accent text-[9px] align-middle ml-1.5">★</span>
                  )}
                  <RankChange rankChange={row.rankChange} />
                </span>
                <span className="text-[17px] tabular-nums">{row.points}</span>
              </>
            )}
          </button>
          {/* No fetch here — the row + form are already props (spec §13.21),
              so the drawer glides straight open to its content, never a
              skeleton. */}
          {/* -mx-5 on the Collapse, not the Drawer: Collapse's overflow-
              hidden would clip the drawer's own negative-margin bleed
              (v1.3.1 hotfix — same fix as FixtureRow). */}
          {!full && (
            <Collapse open={openId === row.teamId} className="-mx-5">
              {everOpenedIds.has(row.teamId) && (
                <Drawer row={{ ...row, compId: comp.id }} form={formByTeam[row.teamId]} />
              )}
            </Collapse>
          )}
        </div>
      ))}
      {usedZones.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-5 pt-4 border-t border-rule
                        font-sans text-[9.5px] text-muted">
          {usedZones.map(z => (
            <span key={z} className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-[2px]" style={{ background: ZONE_META[z].colour }} />
              {ZONE_META[z].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
