// Dual-source cup fixtures (spec §13.7). ESPN is authoritative; BBC
// fills the rounds ESPN hasn't published. BBC sides are re-identified
// onto ESPN teams by normalized name so followed-club matching and
// crests survive the source boundary.
const norm = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const fixtureKey = f =>
  `${(f.kickoff ?? '').slice(0, 10)}|${norm(f.home?.name)}|${norm(f.away?.name)}`;

// Index a single {id, name, shortName, ...} entry under both its full name
// and its shortName alias (skipping empty/duplicate keys) — ESPN's
// shortName is often exactly the abbreviation the BBC feed uses as a full
// name (e.g. 'Inverness CT' for Inverness Caledonian Thistle). First
// writer wins per key, never overwritten by a later add.
function indexEntry(index, t) {
  for (const key of [norm(t.name), norm(t.shortName)]) {
    if (key && !index.has(key)) index.set(key, t);
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

function reidentify(side, index) {
  const t = index.get(norm(side.name));
  if (!t) return side;
  return { ...side, teamId: t.id, name: t.name, shortName: t.shortName,
    crestUrl: t.crestUrl, monogram: t.monogram, colour: t.colour };
}

export function mergeCupFixtures(espnFixtures, bbcFixtures, teamIndex, compId) {
  const index = harvestFixtureIdentities(teamIndex, espnFixtures);
  const seen = new Set(espnFixtures.map(fixtureKey));
  const extras = bbcFixtures
    .filter(f => !seen.has(fixtureKey(f)))
    .map(f => ({
      ...f,
      id: `bbc-${f.id}`,
      compId,
      home: reidentify(f.home, index),
      away: reidentify(f.away, index),
    }));
  return [...espnFixtures, ...extras]
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
}
