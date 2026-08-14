// Dual-source cup fixtures (spec §13.7). ESPN is authoritative; BBC
// fills the rounds ESPN hasn't published. BBC sides are re-identified
// onto ESPN teams by normalized name so followed-club matching and
// crests survive the source boundary.
const norm = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const fixtureKey = f =>
  `${(f.kickoff ?? '').slice(0, 10)}|${norm(f.home?.name)}|${norm(f.away?.name)}`;

// teamLists: arrays of Team ({id, name, shortName, crestUrl, monogram, colour})
export function buildTeamIndex(...teamLists) {
  const index = new Map();
  for (const list of teamLists) {
    for (const t of list ?? []) {
      if (!index.has(norm(t.name))) index.set(norm(t.name), t);
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
  const seen = new Set(espnFixtures.map(fixtureKey));
  const extras = bbcFixtures
    .filter(f => !seen.has(fixtureKey(f)))
    .map(f => ({
      ...f,
      id: `bbc-${f.id}`,
      compId,
      home: reidentify(f.home, teamIndex),
      away: reidentify(f.away, teamIndex),
    }));
  return [...espnFixtures, ...extras]
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
}
