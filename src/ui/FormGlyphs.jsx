// Small W/D/L glyphs (spec §7.3 drawer, §13.8 match room): a filled disc
// for a win, a muted disc for a draw, an outlined disc for a loss. Shared
// between the league table's drawer and the match room's form block —
// callers decide their own label and layout around it.
export default function FormGlyphs({ form }) {
  if (!form?.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      {form.map((r, i) => (
        <span key={i} className={`w-[17px] h-[17px] rounded-full font-sans text-[9px] font-semibold
          inline-flex items-center justify-center ${
            r === 'W' ? 'bg-ink text-paper'
            : r === 'D' ? 'bg-rule text-muted'
            : 'border border-rule text-muted'
          }`}>
          {r}
        </span>
      ))}
    </div>
  );
}
