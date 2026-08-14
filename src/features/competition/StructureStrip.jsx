// The structure strip (spec §13.10.1): a horizontal Broadsheet flow of
// stage nodes — count numeral + small label — joined by hairline
// separators. Wording/counts come from registry config (`comp.structure`);
// this component is pure presentation over that array.
export default function StructureStrip({ structure }) {
  if (!structure || structure.length === 0) return null;
  return (
    <div className="flex flex-wrap items-stretch gap-y-3 pb-4 mb-6 border-b border-rule">
      {structure.map((node, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && (
            <span aria-hidden="true" className="font-sans text-muted text-[12px] mx-2.5">›</span>
          )}
          {/* Every node gets the same two-row shape — a fixed-height numeral
              row (empty for label-only nodes) above the label row — so
              baselines line up across the strip regardless of which nodes
              carry a numeral, and the separators (centered on the full,
              stretched node height via the parent's items-stretch) land at
              a consistent vertical position too. */}
          <div className="flex flex-col items-center text-center min-w-[68px] max-w-[92px]">
            <div className="h-[22px] flex items-end justify-center">
              {node.n != null && (
                <span className="font-serif text-[19px] tabular-nums leading-none">{node.n}</span>
              )}
            </div>
            <span className="font-sans text-[9px] uppercase tracking-[.1em] text-muted leading-tight mt-1">
              {node.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
