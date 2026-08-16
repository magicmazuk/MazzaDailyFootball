// The visual squad experiment (squad-visual branch, Aug 2026): a small
// inline-SVG football jersey — hand-drawn geometry (torso + short sleeves +
// a crew-neck hint of collar) on a 100x100 grid, iterated against a
// headless-Chrome render check until the silhouette held together at the
// 26px default: sleeves read as distinct appendages (they sit outside the
// shoulder line), the underarm has a soft concave notch rather than a
// square corner, and the torso flares a touch toward the hem the way a
// jersey drapes. Flat fill, no gradients, no fold lines.
const JERSEY_PATH = `M 40,14 L 28,8 C 20,9 12,12 8,17 L 17,34 C 22,30 27,28 31,26
  L 23,88 L 77,88 L 69,26 C 73,28 78,30 83,34 L 92,17 C 88,12 80,9 72,8
  L 60,14 C 57,21 43,21 40,14 Z`;

const FALLBACK_FILL = '#F4F0E7'; // drawer token — the BBC/unknown-colour fallback

// YIQ luminance (spec: colour null/undefined never reaches here — callers
// fall back to the drawer hex first, which itself reads well above the
// threshold, so contrastOn only has to cope with real 6-digit hex strings).
export function contrastOn(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? 'ink' : 'white';
}

export default function Shirt({ colour, number, size = 26 }) {
  const fill = colour ? `#${colour}` : FALLBACK_FILL;
  const textFill = contrastOn(colour ?? 'F4F0E7') === 'white' ? '#FFFFFF' : 'currentColor';
  const label = number ?? '—';
  const twoDigit = String(label).length > 1;
  return (
    <svg data-testid="shirt" width={size} height={size} viewBox="0 0 100 100"
      className="text-ink shrink-0" aria-hidden="true">
      <path data-testid="shirt-shape" d={JERSEY_PATH} fill={fill}
        stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <text x="50" y={number == null ? 64 : 58} textAnchor="middle" dominantBaseline="middle"
        fontFamily="system-ui, sans-serif" fontWeight="600" fontSize={twoDigit ? 30 : 38}
        fill={textFill}>
        {label}
      </text>
    </svg>
  );
}
