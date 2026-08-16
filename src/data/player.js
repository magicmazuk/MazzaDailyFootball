// ESPN core-API → player-domain adapters (spec §13.16). Sibling to
// espn.js, split out because these two shapes come from a different
// upstream host (sports.core.api.espn.com) via the proxy's second
// allowlist. Same rule applies: nothing above this file may know
// ESPN's shapes, and every lookup stays null-safe — these are
// undocumented feeds and absent fields are a normal Tuesday.

export function adaptAthlete(json) {
  return {
    id: json?.id ?? null,
    name: json?.displayName ?? json?.fullName ?? 'Unknown',
    position: json?.position?.name ?? null,
    shirt: json?.jersey ?? null,
    age: json?.age ?? null,
    nationality: json?.citizenship ?? null,
    heightDisplay: json?.displayHeight ?? null,
    birthDate: json?.dateOfBirth ?? null,
    birthPlace: formatBirthPlace(json?.birthPlace),
    defaultLeagueCode: extractLeagueCode(json?.defaultLeague?.$ref),
  };
}

function formatBirthPlace(bp) {
  if (!bp) return null;
  const parts = [bp.city, bp.state, bp.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

// Production regression (hotfix, Aug 2026): ESPN only populates a
// player's season statistics (and, separately, a team's roster) under
// the CLUB'S DOMESTIC league grouping — fetch either under a UEFA/cup
// comp and the statistics leg 404s. defaultLeague.$ref carries that
// domestic league's code, e.g. ".../leagues/sco.1?lang=en&region=us" —
// extracted here so usePlayer can route the statistics fetch there
// regardless of which comp the player page was reached through.
function extractLeagueCode(ref) {
  const m = /leagues\/([a-z0-9._]+)/.exec(ref ?? '');
  return m ? m[1] : null;
}

// position is the adapted bio's plain-string position (adaptAthlete's
// output), not the raw ESPN {name, abbreviation, ...} object.
export function isKeeper(athlete) {
  return /keeper/i.test(athlete?.position ?? '');
}

// Output key -> ESPN stat name. The statistics feed spreads a player's
// numbers across splits.categories[] (general/offensive/defensive/
// goalKeeping), and only includes the stats that apply to that player —
// a keeper's shot counters or an outfielder's goalKeeping block can be
// entirely absent rather than zeroed, so a stat not found in ANY
// category is null, never 0 (0 is itself a legitimate value elsewhere).
const STAT_NAMES = {
  appearances: 'appearances',
  starts: 'starts',
  minutes: 'minutes',
  goals: 'totalGoals',
  assists: 'goalAssists',
  shotsOnTarget: 'shotsOnTarget',
  shotsOffTarget: 'shotsOffTarget',
  totalShots: 'totalShots',
  accuratePasses: 'accuratePasses',
  inaccuratePasses: 'inaccuratePasses',
  totalPasses: 'totalPasses',
  passPct: 'passPct',
  foulsCommitted: 'foulsCommitted',
  yellowCards: 'yellowCards',
  redCards: 'redCards',
  effectiveTackles: 'effectiveTackles',
  saves: 'saves',
  cleanSheets: 'cleanSheet',
  goalsConceded: 'goalsConceded',
};

export function adaptPlayerStats(json) {
  const categories = json?.splits?.categories ?? [];
  const find = name => {
    for (const cat of categories) {
      const stat = (cat.stats ?? []).find(s => s.name === name);
      if (stat) return stat.value;
    }
    return undefined;
  };
  const out = {};
  for (const [key, statName] of Object.entries(STAT_NAMES)) {
    const value = find(statName);
    out[key] = value === undefined ? null : value;
  }
  // avgRatingFromDataFeed: the feed uses 0 to mean "unrated", not "rated zero".
  const rating = find('avgRatingFromDataFeed');
  out.rating = rating ? rating : null;
  return out;
}
