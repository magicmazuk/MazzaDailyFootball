// The team sheet (squad-visual branch, Aug 2026, task 3 — mockup C + B):
// the squad page organised around the last starting XI. Presentational —
// TeamScreen does the data step (resolving the last fixture's lineup,
// matching starters back to squad players for their shirt/position) and
// hands this component plain arrays.
//
// Two mutually-exclusive states inside the same pitch frame:
//   - starters known: a vertical pitch, one row per occupied position
//     bucket, GK nearest the bottom (own goal) to forwards nearest the top.
//   - no lineup yet (pre-season, a BBC fixture, or detail still loading):
//     the same frame falls back to the whole squad in position bands
//     (mockup A) — nobody's starting status is known, so nobody's excluded.
// Below either state, a Rail carries "squad minus starters" in shirt-number
// order — literally the rest of the squad when no XI is known (bands
// already showed everyone, but the rail is a second, number-ordered way to
// browse the same names), and just the bench when an XI is known.
import Rail from '../../ui/Rail.jsx';
import Shirt from '../../ui/Shirt.jsx';

// Same first-letter matching as the position abbreviations ESPN and BBC
// both publish ('G'/'D'/'M'/'F' or full names) — see the equivalent
// bucketing that used to live in TeamScreen before this component existed.
const BUCKETS = [
  { key: 'gk', label: 'GK', sectionLabel: 'Goalkeepers', match: /^g/i },
  { key: 'def', label: 'DEF', sectionLabel: 'Defenders', match: /^d/i },
  { key: 'mid', label: 'MID', sectionLabel: 'Midfield', match: /^m/i },
  { key: 'fwd', label: 'FWD', sectionLabel: 'Forwards', match: /^f/i },
];

function bucketOf(player) {
  return BUCKETS.find(b => b.match.test(player.position ?? '')) ?? null;
}

// Groups into the four buckets plus a trailing catch-all for anything
// unrecognised (null position, an unfamiliar abbreviation) — never drops a
// player. Returns only non-empty groups, in pitch order (GK first).
function groupByBucket(players) {
  const buckets = BUCKETS.map(b => ({ ...b, players: [] }));
  const leftover = { key: 'squad', label: 'SQD', sectionLabel: 'Squad', players: [] };
  for (const p of players) {
    const b = bucketOf(p);
    (b ? buckets.find(x => x.key === b.key) : leftover).players.push(p);
  }
  return [...buckets, leftover].filter(g => g.players.length > 0);
}

// The formation caption (e.g. "4-3-3"): outfield bucket counts among the
// starters, defence-midfield-attack order. A starter with no recognisable
// position (shouldn't happen with real lineup data) simply isn't counted —
// the caption is descriptive, not a data-integrity check.
export function formation(starters) {
  const counts = { def: 0, mid: 0, fwd: 0 };
  for (const p of starters ?? []) {
    const b = bucketOf(p);
    if (b && counts[b.key] != null) counts[b.key] += 1;
  }
  return `${counts.def}-${counts.mid}-${counts.fwd}`;
}

const surname = name => name.trim().split(/\s+/).pop();

function byShirtNumber(a, b) {
  const na = a.shirt != null && a.shirt !== '' ? Number(a.shirt) : Infinity;
  const nb = b.shirt != null && b.shirt !== '' ? Number(b.shirt) : Infinity;
  return na - nb;
}

// Row placement for the starters pitch: evenly spaced within a 12%-100%
// margin, index 0 (GK) nearest the bottom, the last row nearest the top —
// "GK-bottom -> F-top" per the brief. A single occupied row centres.
function rowTop(index, total) {
  if (total <= 1) return 50;
  const margin = 12;
  const span = 100 - margin * 2;
  return 100 - margin - (index * span) / (total - 1);
}

function PitchFrame({ fixedHeight, children }) {
  return (
    <div className={`relative border border-ink rounded-md mb-6 ${fixedHeight ? 'h-[300px]' : 'py-1'}`}>
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-rule -translate-y-1/2" />
      <div aria-hidden className="absolute inset-x-[30%] top-0 h-[26px] border border-rule border-t-0" />
      <div aria-hidden className="absolute inset-x-[30%] bottom-0 h-[26px] border border-rule border-b-0" />
      {children}
    </div>
  );
}

function ShirtUnit({ player, colour, size, onOpenPlayer, className = '' }) {
  return (
    <button type="button" onClick={() => onOpenPlayer(player.id)} aria-label={player.name}
      className={`flex flex-col items-center gap-1 ${className}`}>
      <Shirt colour={colour} number={player.shirt} size={size} />
      <span className="font-sans text-[8.5px] text-muted text-center truncate max-w-[60px]">
        {surname(player.name)}
      </span>
    </button>
  );
}

function PitchRow({ group, top, colour, onOpenPlayer }) {
  return (
    <div data-testid={`pitch-row-${group.key}`} className="absolute inset-x-0 flex justify-evenly px-2"
      style={{ top: `${top}%`, transform: 'translateY(-50%)' }}>
      {group.players.map(p => (
        <ShirtUnit key={p.id} player={p} colour={colour} size={28} onOpenPlayer={onOpenPlayer} />
      ))}
    </div>
  );
}

function Band({ group, colour, onOpenPlayer, first }) {
  return (
    <div data-testid={`squad-band-${group.key}`}
      className={`px-2 py-2.5 ${first ? '' : 'border-t border-dashed border-rule'}`}>
      <p className="font-sans text-[7.5px] uppercase tracking-[.16em] text-muted mb-2">
        {group.sectionLabel}
      </p>
      <div className="flex flex-wrap gap-x-2 gap-y-2.5 justify-center">
        {group.players.map(p => (
          <ShirtUnit key={p.id} player={p} colour={colour} size={26} onOpenPlayer={onOpenPlayer} className="w-11" />
        ))}
      </div>
    </div>
  );
}

// The rail unit: a short hook hanging from the rod above (mockup B), the
// shirt, the name — same tappable shirt-icon-plus-surname shape as every
// other unit here, just bigger.
function RailUnit({ player, colour, onOpenPlayer }) {
  return (
    <div className="rail-item shrink-0 flex flex-col items-center">
      <div aria-hidden className="w-px h-[7px] bg-muted" />
      <ShirtUnit player={player} colour={colour} size={38} onOpenPlayer={onOpenPlayer} className="w-[52px] mt-1" />
    </div>
  );
}

export default function SquadBoard({ players, starters, teamColour, opponentShortName, onOpenPlayer }) {
  if (!players?.length) return null;
  const hasXI = Array.isArray(starters) && starters.length > 0;
  const starterIds = new Set((starters ?? []).map(p => p.id));
  const rest = players.filter(p => !starterIds.has(p.id)).slice().sort(byShirtNumber);
  const groups = hasXI ? groupByBucket(starters) : groupByBucket(players);

  return (
    <div>
      {hasXI && (
        <p className="font-sans text-[10px] text-muted mb-2">
          Last match · {formation(starters)}{opponentShortName ? ` v ${opponentShortName}` : ''}
        </p>
      )}
      <PitchFrame fixedHeight={hasXI}>
        {hasXI
          ? groups.map((g, i) => (
              <PitchRow key={g.key} group={g} top={rowTop(i, groups.length)}
                colour={teamColour} onOpenPlayer={onOpenPlayer} />
            ))
          : groups.map((g, i) => (
              <Band key={g.key} group={g} colour={teamColour} onOpenPlayer={onOpenPlayer} first={i === 0} />
            ))}
      </PitchFrame>
      {/* The rail is the bench: "squad minus starters" only means something
          once starters is a real subset of the squad. In fallback (bands)
          mode every player is already on the board above — starters is
          empty there, so "squad minus starters" is the whole squad again,
          and a second rail listing the same names underneath would just be
          the page repeating itself. So the rail renders only once an XI is
          known; "The rest of the squad" is the label this section would
          carry if that ever changed, kept here as documented intent rather
          than shipped as a visible duplicate. */}
      {hasXI && (
        <div>
          <p className="font-sans text-[9.5px] uppercase tracking-[.18em] text-muted mb-2">
            The bench & the rest
          </p>
          <div aria-hidden className="h-px bg-ink" />
          <Rail className="pt-[7px]">
            {rest.map(p => <RailUnit key={p.id} player={p} colour={teamColour} onOpenPlayer={onOpenPlayer} />)}
          </Rail>
        </div>
      )}
    </div>
  );
}
