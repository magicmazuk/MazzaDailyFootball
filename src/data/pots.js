// The pots (spec §13.39): which coefficient pot a league-phase opponent
// was drawn from. CURATED data (pots.json, the tvListings precedent) —
// UEFA publishes placements the day of the draw, and the file is
// hand-refreshed per season. Lookup is name-based (the feed carries no
// pot), accent- and case-insensitive, and errs to null: an uncurated
// club simply wears no chip — never a guess.
import POTS from './pots.json';

const norm = s => String(s ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function potFor(compId, side, table = POTS) {
  if (side == null) return null;
  const pots = table?.[compId]?.pots;
  if (!pots) return null;
  const names = [norm(side.name), norm(side.shortName)].filter(Boolean);
  for (const [pot, clubs] of Object.entries(pots)) {
    if (!Array.isArray(clubs)) continue;
    if (clubs.some(c => names.includes(norm(c)))) return Number(pot);
  }
  return null;
}
