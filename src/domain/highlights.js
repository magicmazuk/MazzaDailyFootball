// The highlights reel's join (spec §13.36). Pure derivations over episodes
// (adapted iPlayer payloads) and the standard Fixture shape — no UI, no
// fetching. Honesty by tier: an episode COVERS a finished fixture by London
// broadcast day alone; it FEATURES one only when the synopsis names both
// clubs, derby-guarded so a Manchester never borrows the other's mention.

const FRESH_MS = 36 * 60 * 60 * 1000;

const toMs = value => {
  if (value == null) return NaN;
  return value instanceof Date ? value.getTime() : Date.parse(value);
};

// Fresh = first broadcast within the last 36 hours (never the future) and,
// when the feed dates its availability, not yet expired. The freshness
// clock keys off firstBroadcast — a Monday-morning repeat airing never
// re-freshens Sunday's episode (ledger: schedule_date lies).
export function isFresh(episode, now) {
  const first = toMs(episode?.firstBroadcast);
  const at = toMs(now);
  if (Number.isNaN(first) || Number.isNaN(at)) return false;
  const age = at - first;
  if (age < 0 || age > FRESH_MS) return false;
  const until = toMs(episode.availableUntil);
  if (!Number.isNaN(until) && until < at) return false;
  return true;
}

// The London calendar day of an instant — the day the broadsheet means when
// it says "Saturday's games". en-CA prints ISO YYYY-MM-DD directly.
export function londonDate(iso) {
  if (iso == null) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

// Date-join coverage: finished, in the show's league, kicked off on the
// episode's broadcast day. Nothing else — postponed and live wait.
export function covers(episode, fixture) {
  if (episode == null || fixture == null) return false;
  const day = londonDate(fixture.kickoff);
  return fixture.status === 'ft'
    && fixture.compId === episode.comp?.id
    && day != null
    && day === episode.date;
}

// --- featured matching -----------------------------------------------------

// Tokens too generic to identify a club on their own ('United' names half
// the league); stripped before matching, per §13.36.
const GENERIC = new Set([
  'fc', 'afc', 'cf', 'united', 'city', 'town', 'county', 'athletic',
  'albion', 'wanderers', 'rovers', 'hotspur', 'and',
]);

// Lowercase, diacritics folded (NFD + combining-mark strip), punctuation
// flattened to spaces — 'Saint-Étienne' and 'saint etienne' meet here.
const normalise = s => s
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// A club's identity for matching: its full normalised name, and its
// distinctive tokens (name minus the generic set), keyed for comparison.
const clubIdentity = name => {
  const full = normalise(name);
  const tokens = full.split(' ').filter(t => t !== '' && !GENERIC.has(t));
  return { full, tokens, key: [...tokens].sort().join(' ') };
};

// Whole-phrase presence in an already-normalised text (space-delimited words
// only, so padding gives exact word boundaries).
const hasPhrase = (text, phrase) =>
  phrase !== '' && ` ${text} `.includes(` ${phrase} `);

// Featured = the synopsis names BOTH clubs. Default is whole-word token
// matching; the derby guard demands the full name as a phrase whenever
// another club on the day's card strips to the same tokens (both
// Manchesters → 'manchester'), or when a club's tokens strip to nothing.
export function isFeatured(episode, fixture, dayFixtures) {
  const synopsis = episode?.synopsis;
  if (synopsis == null || fixture?.home?.name == null || fixture?.away?.name == null) {
    return false;
  }
  const text = normalise(synopsis);
  const words = new Set(text.split(' '));
  const dayClubs = (dayFixtures ?? [])
    .flatMap(f => [f?.home?.name, f?.away?.name])
    .filter(n => n != null)
    .map(clubIdentity);
  return [fixture.home.name, fixture.away.name].every(name => {
    const club = clubIdentity(name);
    const ambiguous = club.tokens.length === 0
      || dayClubs.some(other => other.full !== club.full && other.key === club.key);
    if (ambiguous) return hasPhrase(text, club.full);
    return club.tokens.every(t => words.has(t));
  });
}

// The two copy tiers — no other variants (§13.36).
export function highlightLine(episode, featured) {
  if (episode?.show == null) return null;
  return featured ? `Featured on ${episode.show}` : `Highlights · ${episode.show}`;
}

// The Today listing's feed: fresh episodes only, feed order kept.
export function freshEpisodes(episodes, now) {
  return (episodes ?? []).filter(e => isFresh(e, now));
}
