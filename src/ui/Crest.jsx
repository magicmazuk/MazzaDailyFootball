// Crest with monogram fallback (spec §8.5). Crestless clubs are a
// normal case — 58 of 60 Scottish Cup first-round entrants — never an
// error state.
export default function Crest({ side, size = 22 }) {
  if (side.crestUrl) {
    return (
      <img src={side.crestUrl} alt={side.name} width={size} height={size}
        loading="lazy" className="shrink-0 object-contain" />
    );
  }
  return (
    <span
      aria-label={side.name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className="shrink-0 rounded-full border border-rule bg-paper text-muted font-serif
                 inline-flex items-center justify-center leading-none"
    >
      {side.monogram}
    </span>
  );
}
