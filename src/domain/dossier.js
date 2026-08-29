// The Scout's Dossier identity desk (spec §13.37). Pure logic over the
// dossier adapters' shapes — no fetching, no React. The law: never show an
// unverified identity. A wrong face on the right name is worse than no face,
// so every function here errs toward null.
import { knownAs } from './aliases.js';

// Lowercase, diacritics folded (NFD + combining-mark strip), punctuation
// flattened to spaces — 'Cláudio' and 'claudio' meet here. Null in → ''.
export const normalise = s => {
  if (s == null) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

// Whole-phrase presence in an already-normalised text (space-delimited words
// only, so padding gives exact word boundaries).
const hasPhrase = (text, phrase) =>
  phrase !== '' && ` ${text} `.includes(` ${phrase} `);

// The last token of a normalised name — the surname prose actually uses.
const surnameOf = name => {
  const tokens = normalise(name).split(' ');
  return tokens[tokens.length - 1];
};

// For CLUB verification only the designators strip — fc / afc / football
// club (and 'f c', which is what 'F.C.' normalises to). 'City', 'United'
// et al stay: this is phrase verification, not §13.36's token identity.
// A club stripping to nothing falls back to its full normalised name.
const clubPhrase = club => {
  const full = normalise(club);
  const tokens = full.split(' ').filter(t => t !== '');
  const kept = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (t === 'fc' || t === 'afc') continue;
    if (t === 'football' && next === 'club') { i += 1; continue; }
    if (t === 'f' && next === 'c') { i += 1; continue; }
    kept.push(t);
  }
  const stripped = kept.join(' ');
  return stripped === '' ? full : stripped;
};

// A summary renders ONLY when it is a standard page whose extract names both
// the player's surname and his current club, whole words. Anything less —
// disambiguation pages, the wrong club, missing pieces — is null.
export function verifiedSummary(summary, context) {
  const { name, club } = context ?? {};
  if (summary == null || name == null || club == null) return null;
  if (summary.kind !== 'standard') return null;
  const text = normalise(summary.extract);
  if (text === '') return null;
  const surname = surnameOf(name);
  if (!hasPhrase(text, surname)) return null;
  const phrase = clubPhrase(club);
  if (!hasPhrase(text, phrase)) return null;
  return summary;
}

// The disambiguation fallback's search query. No name, no query.
export function searchQuery(name, club) {
  if (name == null) return null;
  return club == null ? `${name} footballer` : `${name} footballer ${club}`;
}

// From search-result titles, the first that carries the player's surname as
// a whole word ('James Forrest (footballer, born 1991)' passes; 'Celtic
// F.C.' never does). Null when none.
export function pickSearchTitle(titles, name) {
  if (titles == null || name == null) return null;
  const surname = surnameOf(name);
  if (surname === '') return null;
  for (const title of titles) {
    if (title != null && hasPhrase(normalise(title), surname)) return title;
  }
  return null;
}

// Team-name matching for the joins: exact first, then containment either way
// (ESPN 'Newcastle United' meets FPL 'Newcastle') — but the match must be
// UNIQUE among the candidates, else null ('Manchester' contains into both
// Manchester clubs and identifies neither).
const namesMatch = (a, b) => a !== '' && b !== ''
  && (a === b || hasPhrase(a, b) || hasPhrase(b, a));

// The club's FPL team id — exact-name first, containment either way as the
// fallback, and only when it names exactly ONE team (the two Manchesters
// rule). The dossier's face join and the fantasy ladder (spec §13.40)
// share this seam so "which team is this club" has one answer everywhere.
export function fplTeamId(index, club) {
  if (index == null || club == null) return null;
  const clubN = normalise(club);
  if (clubN === '') return null;
  const teams = (index.teams ?? [])
    .map(t => ({ team: t, n: normalise(t?.name) }))
    .filter(x => x.n !== '');
  // Three tiers, each only when the last found nothing: exact name,
  // phrase containment, then the nickname ledger (spec 13.41) - "Man
  // City" and "Manchester City" meet only through knownAs. Uniqueness
  // rules every tier: a club string whose forms reach two teams (bare
  // "Manchester") identifies neither.
  const exact = teams.filter(x => x.n === clubN);
  const contained = exact.length > 0
    ? exact
    : teams.filter(x => namesMatch(x.n, clubN));
  const clubForms = knownAs(club);
  const matched = contained.length > 0
    ? contained
    : teams.filter(x =>
      knownAs(x.team.name).some(tf => clubForms.some(cf => namesMatch(tf, cf))));
  return matched.length === 1 ? (matched[0].team.id ?? null) : null;
}

// The FPL join: find the club's team, then match the player INSIDE that team
// only — full name first, web_name-equals-surname as the fallback and only
// when it names exactly one man. Never across teams.
export function fplFace(index, context) {
  const { name, club } = context ?? {};
  if (index == null || name == null || club == null) return null;
  const teamId = fplTeamId(index, club);
  if (teamId == null) return null;
  const squad = (index.players ?? []).filter(p => p != null && p.team === teamId);
  const nameN = normalise(name);
  const full = squad.filter(p => normalise(`${p.first ?? ''} ${p.second ?? ''}`) === nameN);
  if (full.length === 1) return full[0].code ?? null;
  if (full.length > 1) return null;
  const surname = surnameOf(name);
  const byWeb = squad.filter(p => normalise(p.web) === surname);
  if (byWeb.length === 1) return byWeb[0].code ?? null;
  return null;
}

// The TSDB join: the hit's name must EQUAL the player's, and its strTeam
// (current — TSDB knows transfers) must match the club we hold. A stale
// context club is an honest miss. Returns cutout ?? thumb, else null.
export function tsdbFace(players, context) {
  const { name, club } = context ?? {};
  if (players == null || name == null || club == null) return null;
  const nameN = normalise(name);
  const clubN = normalise(club);
  if (nameN === '' || clubN === '') return null;
  for (const p of players) {
    if (p == null || normalise(p.name) !== nameN) continue;
    // Team agreement across ledger forms (spec §13.41): TSDB's "Man City"
    // and ESPN's "Manchester City" are the same club, known differently.
    const clubForms = knownAs(club);
    const teamForms = knownAs(p.team);
    if (!teamForms.some(tf => clubForms.some(cf => namesMatch(tf, cf)))) continue;
    const face = p.cutout ?? p.thumb ?? null;
    if (face != null) return face;
  }
  return null;
}

// The face fallback order (spec §13.37): verified Wikipedia portrait → FPL
// headshot code (caller renders the URL) → TSDB url → none. Provenance is
// the callers' duty — this trusts what it is handed. The source key feeds
// the credit line.
export function faceFor(input) {
  const { wiki, fplCode, tsdb } = input ?? {};
  if (wiki != null) return { src: wiki, source: 'wikimedia' };
  if (fplCode != null) return { code: fplCode, source: 'premier-league' };
  if (tsdb != null) return { src: tsdb, source: 'thesportsdb' };
  return null;
}

// The plate credit, per source — a broadsheet credits its photographs.
const CREDITS = {
  wikimedia: 'Wikimedia Commons',
  'premier-league': 'Premier League',
  thesportsdb: 'TheSportsDB',
};

export function creditFor(source) {
  return CREDITS[source] ?? null;
}
