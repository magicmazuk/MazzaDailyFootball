// Round slug → display label (spec §13.8). ESPN's season.slug for a
// knockout round is a hyphenated, unpunctuated fragment ('fourth-round',
// 'quarterfinals'); league/group phases carry their own slugs that never
// belong in a match room kicker, so they resolve to null (no ' · round'
// suffix), same as a fixture with no round at all.
const EXCLUDED = new Set(['regular-season', 'league-phase', 'group-stage']);

// League fixtures (as opposed to cup/knockout ones) carry the SEASON name
// in season.slug instead — e.g. '2026-27-scottish-premiership' (sco.1),
// '2025-26-english-premier-league' (eng.1). No real round slug starts with
// a year, so this is rejected outright rather than prettified into noise.
// Exported so field.js's fallbackRoundLabel can reject the same slugs
// prettifyRound does, rather than title-casing a season name into noise.
export const YEAR_PREFIXED = /^\d{4}-\d{2}-/;

// A handful of round names are single compound words that don't split
// cleanly on '-' the way 'fourth-round' does.
// 'playoff-round' is the UEFA qualifying-rounds code's own slug for what
// Broadsheet style spells "Play-off" (hyphenated, as in zones.js's `po`
// label and the UEFA structure strip) — the generic splitter below would
// otherwise render it "Playoff round".
const IRREGULAR = {
  quarterfinals: 'Quarter-finals',
  semifinals: 'Semi-finals',
  'playoff-round': 'Play-off round',
};

export function prettifyRound(slug) {
  if (!slug || EXCLUDED.has(slug) || YEAR_PREFIXED.test(slug)) return null;
  if (IRREGULAR[slug]) return IRREGULAR[slug];
  const [first, ...rest] = slug.split('-');
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}
