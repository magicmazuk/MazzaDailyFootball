// Round slug → display label (spec §13.8). ESPN's season.slug for a
// knockout round is a hyphenated, unpunctuated fragment ('fourth-round',
// 'quarterfinals'); league/group phases carry their own slugs that never
// belong in a match room kicker, so they resolve to null (no ' · round'
// suffix), same as a fixture with no round at all.
const EXCLUDED = new Set(['regular-season', 'league-phase', 'group-stage']);

// A handful of round names are single compound words that don't split
// cleanly on '-' the way 'fourth-round' does.
const IRREGULAR = {
  quarterfinals: 'Quarter-finals',
  semifinals: 'Semi-finals',
};

export function prettifyRound(slug) {
  if (!slug || EXCLUDED.has(slug)) return null;
  if (IRREGULAR[slug]) return IRREGULAR[slug];
  const [first, ...rest] = slug.split('-');
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}
