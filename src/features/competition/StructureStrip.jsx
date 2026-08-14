// The structure strip (spec §13.10.1): a horizontal Broadsheet flow of
// stage nodes — count numeral + small label — joined by hairline
// separators. Wording/counts come from registry config (`comp.structure`);
// this component is pure presentation over that array.
export default function StructureStrip({ structure }) {
  if (!structure || structure.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start gap-y-3 pb-4 mb-6 border-b border-rule">
      {structure.map((node, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && (
            <span aria-hidden="true" className="font-sans text-muted text-[12px] mx-2.5">›</span>
          )}
          <div className="flex flex-col items-center text-center w-[68px]">
            {node.n != null && (
              <span className="font-serif text-[19px] tabular-nums leading-none">{node.n}</span>
            )}
            <span className={`font-sans text-[9px] uppercase tracking-[.1em] text-muted leading-tight ${
              node.n != null ? 'mt-1' : ''}`}>
              {node.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
