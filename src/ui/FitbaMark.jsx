// The Fitba' Times nameplate (spec §13.27): the goalmouth-FT mark and the
// wordmark, both drawn as SVG — a LOGO, not typography, so the closed type
// set gains no new recipe. Colours ride the tokens through the repo's
// currentColor idiom (outer svg text-ink; the net's group text-rule): a
// future palette retune moves the mark with every hairline. One accessible
// name on the wrapper; every drawing is decoration beneath it.
export default function FitbaMark({ height = 19 }) {
  const wordmarkHeight = height * 0.74;
  return (
    <span role="img" aria-label="Fitba' Times" className="inline-flex items-center gap-2.5">
      <svg aria-hidden="true" className="text-ink" height={height} viewBox="0 0 120 88">
        <g className="text-rule" stroke="currentColor" strokeWidth="3">
          <line x1="36" y1="14" x2="36" y2="74" />
          <line x1="61" y1="14" x2="61" y2="74" />
          <line x1="86" y1="14" x2="86" y2="74" />
          <line x1="16" y1="34" x2="106" y2="34" />
          <line x1="16" y1="55" x2="106" y2="55" />
        </g>
        <rect x="10" y="6" width="102" height="11" rx="3" fill="currentColor" />
        <rect x="10" y="6" width="10" height="70" rx="3" fill="currentColor" />
        <rect x="102" y="6" width="10" height="70" rx="3" fill="currentColor" />
        <rect x="2" y="73" width="118" height="8" rx="3" fill="currentColor" />
        <text x="61" y="64" textAnchor="middle" fill="currentColor" fontWeight="700"
          fontSize="46" fontFamily="Georgia, 'Times New Roman', serif">FT</text>
      </svg>
      <svg aria-hidden="true" className="text-ink" height={wordmarkHeight} viewBox="0 0 252 34">
        <text x="0" y="27" fill="currentColor" fontWeight="700" fontSize="30"
          letterSpacing="1.2" fontFamily="Georgia, 'Times New Roman', serif">FITBA&rsquo; TIMES</text>
      </svg>
    </span>
  );
}
