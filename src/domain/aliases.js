// Known as (spec §13.41): the nickname ledger. Phrase containment bridges
// truncation ("Newcastle United" ↔ "Newcastle") but never ABBREVIATION —
// FPL prints "Man City", the BBC's prose says "Spurs" and "Wolves" — so
// this small curated table records how clubs are actually known. Unlike
// the pots it is curated once, not per season: nicknames outlive squads.
// Every group is stored NORMALISED (see dossier.js's normalise); knownAs
// returns every form of a name, the name's own form first, so callers can
// try each without caring which column of the ledger they walked in from.
//
// Local normalise (the highlights.js precedent): domain files keep their
// own copy rather than importing across siblings — dossier.js imports
// THIS file, so reaching back would be circular.
const normalise = s => {
  if (s == null) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

// Each row is one club's set of interchangeable names. Keep entries
// SPECIFIC — never a bare word that could be two clubs ("forest" alone
// could be anyone's; "manchester" is two clubs and belongs to neither).
const LEDGER = [
  ['manchester city', 'man city'],
  ['manchester united', 'man utd', 'man united'],
  ['nottingham forest', 'nott m forest', 'nottm forest'],
  ['tottenham hotspur', 'spurs', 'tottenham'],
  ['wolverhampton wanderers', 'wolves'],
  ['brighton hove albion', 'brighton'],
  ['west bromwich albion', 'west brom'],
  ['heart of midlothian', 'hearts'],
  ['hibernian', 'hibs'],
];

export function knownAs(name) {
  const n = normalise(name);
  if (n === '') return [];
  const row = LEDGER.find(forms => forms.includes(n));
  if (!row) return [n];
  return [n, ...row.filter(f => f !== n)];
}
