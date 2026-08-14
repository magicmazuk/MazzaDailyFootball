// Dual-source cup fixtures (spec §13.7). ESPN is authoritative; BBC
// fills the rounds ESPN hasn't published. BBC sides are re-identified
// onto ESPN teams by normalized name (or a known alias) so followed-club
// matching and crests survive the source boundary.
const norm = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const stripLeadingThe = s => s.replace(/^the\s+/i, '');
const stripTrailingFc = s => s.replace(/\s+fc\.?$/i, '');

// A club's normalized identity can be spelled several ways across ESPN and
// BBC — 'Spartans FC' (ESPN) vs 'The Spartans' (BBC), 'Inverness
// Caledonian Thistle' (ESPN name) vs 'Inverness CT' (ESPN shortName, which
// the BBC feed uses as its full name). Return every candidate key —
// the full normalized name, the name minus a leading 'the', and the name
// minus a trailing 'fc' — deduped, non-empty, in that preference order so
// an exact match always wins over an alias.
function nameKeys(name) {
  const raw = name ?? '';
  const keys = [norm(raw), norm(stripLeadingThe(raw)), norm(stripTrailingFc(raw))]
    .filter(Boolean);
  return [...new Set(keys)];
}

const fixtureKey = f =>
  `${(f.kickoff ?? '').slice(0, 10)}|${norm(f.home?.name)}|${norm(f.away?.name)}`;

// Index a single {id, name, shortName, ...} entry under every alias key of
// both its full name and its shortName. First writer wins per key, never
// overwritten by a later add.
function indexEntry(index, t) {
  for (const key of [...nameKeys(t.name), ...nameKeys(t.shortName)]) {
    if (!index.has(key)) index.set(key, t);
  }
}

// teamLists: arrays of Team ({id, name, shortName, crestUrl, monogram, colour})
export function buildTeamIndex(...teamLists) {
  const index = new Map();
  for (const list of teamLists) {
    for (const t of list ?? []) indexEntry(index, t);
  }
  return index;
}

// Some clubs never appear in a sco.1/sco.2 teams-endpoint list (e.g. a
// club ESPN only ever surfaces as a cup fixture side) but ARE identifiable
// once ESPN has shown them in this competition's own fixtures — harvest an
// {id, name, shortName, crestUrl, monogram, colour} entry from every ESPN
// side seen so far and fold it into a copy of the index, never overwriting
// an entry the caller already supplied (a real teams-endpoint record wins).
function harvestFixtureIdentities(teamIndex, espnFixtures) {
  const index = new Map(teamIndex);
  for (const f of espnFixtures ?? []) {
    for (const side of [f.home, f.away]) {
      if (side?.teamId == null) continue;
      indexEntry(index, { id: side.teamId, name: side.name, shortName: side.shortName,
        crestUrl: side.crestUrl, monogram: side.monogram, colour: side.colour });
    }
  }
  return index;
}

// Try each of the side's name aliases in order (exact name first, then the
// 'the'/'fc'-stripped variants) until one resolves in the index.
function reidentify(side, index) {
  for (const key of nameKeys(side.name)) {
    const t = index.get(key);
    if (t) {
      return { ...side, teamId: t.id, name: t.name, shortName: t.shortName,
        crestUrl: t.crestUrl, monogram: t.monogram, colour: t.colour };
    }
  }
  return side;
}

export function mergeCupFixtures(espnFixtures, bbcFixtures, teamIndex, compId) {
  const index = harvestFixtureIdentities(teamIndex, espnFixtures);
  // Re-identify BBC sides onto their ESPN identity FIRST, then compute
  // dedupe keys from the (now alias-normalised) names — otherwise a BBC
  // fixture spelled via an alias ('The Spartans') never matches its ESPN
  // twin ('Spartans FC') on fixtureKey, and survives as a phantom
  // duplicate row for a match ESPN already reported.
  const reidentified = bbcFixtures.map(f => ({
    ...f,
    home: reidentify(f.home, index),
    away: reidentify(f.away, index),
  }));
  const seen = new Set(espnFixtures.map(fixtureKey));
  const extras = reidentified
    .filter(f => !seen.has(fixtureKey(f)))
    .map(f => ({ ...f, id: `bbc-${f.id}`, compId }));
  return [...espnFixtures, ...extras]
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
}
