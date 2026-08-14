// The T1 table (spec §7.3): four permanent columns, tap a row to open
// its full record in a drawer. The split is drawn as a real event.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Crest from '../../ui/Crest.jsx';
import FormGlyphs from '../../ui/FormGlyphs.jsx';
import { ZONE_META, zoneFor } from './zones.js';

function Drawer({ row, form }) {
  const cells = [
    ['P', row.played], ['W', row.won], ['D', row.drawn],
    ['L', row.lost], ['GF', row.goalsFor], ['GA', row.goalsAgainst],
  ];
  return (
    <div className="bg-drawer -mx-5 px-5 py-4">
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

export default function LeagueTable({ comp, rows, followedIds, formByTeam }) {
  const [openId, setOpenId] = useState(null);
  const usedZones = [...new Set(rows.map(r => zoneFor(comp, r.position)).filter(Boolean))];
  return (
    <div>
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
            onClick={() => setOpenId(openId === row.teamId ? null : row.teamId)}
            className="w-full text-left flex items-center gap-3 py-3 border-b border-rule/70">
            <span className="w-0.5 self-stretch rounded-sm -mr-1"
              style={{ background: ZONE_META[zoneFor(comp, row.position)]?.colour ?? 'transparent' }} />
            <span className="w-5 font-sans text-[12px] text-muted tabular-nums shrink-0">
              {row.position}
            </span>
            <Crest side={row} size={22} />
            <span className="flex-1 min-w-0 truncate text-[15px]">
              {row.name}
              {followedIds.has(row.teamId) && (
                <span className="text-accent text-[9px] align-middle ml-1.5">★</span>
              )}
            </span>
            <span className="text-[17px] tabular-nums">{row.points}</span>
          </button>
          {openId === row.teamId && (
            <Drawer row={{ ...row, compId: comp.id }} form={formByTeam[row.teamId]} />
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
