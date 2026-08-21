// Crests for the crestless (spec §13.32). Two mechanisms, both honest:
// unmatched clubs keep the monogram — never a broken image, never a guess.
//
// 1. WoSFL: a CURATED map over self-hosted files (the tvListings
//    precedent). TheSportsDB covered only 2 of the First Division's 16
//    (the famous junior badges live up in the Premier), so the mechanism
//    matters more than tonight's coverage: drop a PNG into
//    public/crests/wosfl/{teamId}.png, add its line here, and the paper
//    wears it. Bellshill's own crest is the user's to source (147611871).
//
// 2. BBC League One/Two: ESPN quietly carries sco.3 and sco.4 with real
//    logos (10/10 and 6/10, live-probed 2026-08-22). Their teams payloads
//    become a normalised-name index applied over BBC fixtures — STRICT
//    equality on the same minimal norm dedupePairings uses, no fuzzy
//    matching, because a wrong crest is worse than a monogram.

const WOSFL_CRESTS = {
  105928322: '/crests/wosfl/105928322.png', // Threave Rovers
  147611871: '/crests/wosfl/147611871.png', // Bellshill Athletic — HERE WE GO
  294941809: '/crests/wosfl/294941809.png', // Bonnyton Thistle
  296840793: '/crests/wosfl/296840793.png', // Blantyre Victoria
  411509046: '/crests/wosfl/411509046.png', // Thorniewood United
  558460535: '/crests/wosfl/558460535.png', // Kilsyth Rangers
  764779648: '/crests/wosfl/764779648.png', // Lesmahagow Juniors
  853461137: '/crests/wosfl/853461137.png', // Maryhill — the ship since 1884
  526691012: '/crests/wosfl/526691012.png', // Lanark United
  394088753: '/crests/wosfl/394088753.png', // Whitletts Victoria
  991683293: '/crests/wosfl/991683293.png', // Cambuslang Rangers
  168281523: '/crests/wosfl/168281523.png', // Neilston — the Farmer's Boys
  814140867: '/crests/wosfl/814140867.png', // Petershill
  451833712: '/crests/wosfl/451833712.png', // Gartcairn — the editor's own drop
  753004191: '/crests/wosfl/753004191.png', // Maybole Juniors — likewise
  914146622: '/crests/wosfl/914146622.png', // Thorn Athletic — the set complete
};

export function wosflCrest(teamId) {
  return WOSFL_CRESTS[teamId] ?? null;
}

const norm = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ESPN /teams payload → Map(normalised displayName → logo href).
export function crestIndexFrom(espnTeamsJson) {
  const teams = espnTeamsJson?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  const idx = new Map();
  for (const t of teams) {
    const team = t?.team ?? {};
    const logo = team.logo ?? team.logos?.[0]?.href ?? null;
    if (team.displayName && logo) idx.set(norm(team.displayName), logo);
  }
  return idx;
}

// Fill ONLY missing crestUrls on adapted fixtures, by strict name match.
export function enrichCrests(fixtures, idx) {
  if (!idx || idx.size === 0) return fixtures;
  return (fixtures ?? []).map(f => ({
    ...f,
    home: enrichSide(f.home, idx),
    away: enrichSide(f.away, idx),
  }));
}

function enrichSide(side, idx) {
  if (!side || side.crestUrl != null) return side;
  const hit = idx.get(norm(side.name));
  return hit ? { ...side, crestUrl: hit } : side;
}
