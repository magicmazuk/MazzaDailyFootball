// Serif monogram for clubs the feeds carry without a crest (spec §8.5).
// "Auchinleck Talbot" → AT, "Banks O'Dee" → BO, "Celtic" → CE.
export function monogram(name) {
  const words = (name ?? '').replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
