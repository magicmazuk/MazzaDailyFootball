// The Scout's Dossier composition hook (spec §13.37) — the one seam the
// player surfaces consume. Orchestrates the identity flow over the raw
// fetch hooks: direct Wikipedia title → (on a disambiguation page or a
// missing page — the summary query 404s/errors) search fallback → picked
// title → verifiedSummary, THE LAW (nothing renders unless the extract
// names the man AND his current club) → the face ladder (verified wiki
// portrait → FPL headshot for eng.1 clubs → TSDB cutout → none).
//
// React rules: every hook is called unconditionally on every render —
// gating happens purely through `enabled` arguments. No club context →
// no dossier at all: the law needs a club to verify against, so every
// fetch stays disarmed and the surfaces print exactly as before.
import {
  useFplIndex, useTsdbPlayers, useWikiSearch, useWikiSummary,
} from '../../data/queries.js';
import { fplPhotoUrl } from '../../data/dossier.js';
import {
  creditFor, faceFor, fplFace, pickSearchTitle, searchQuery, tsdbFace,
  verifiedSummary,
} from '../../domain/dossier.js';

// → { bio: extract|null, face: { src, source }|null, credit: string|null }.
// The FPL code is resolved to its photo URL here, so consumers only ever
// see a renderable src plus the source key feeding the credit line.
export function useDossier(bio, comp, club) {
  const name = bio?.name ?? null;
  const enabled = Boolean(name && club);

  // Tier A: the direct title. A miss — an errored query (missing page),
  // an adapter-refused payload, or a disambiguation page — arms tier B.
  const direct = useWikiSummary(name, enabled);
  const directMissed = enabled && (
    direct.isError === true
    || direct.data?.kind === 'disambiguation'
    || (direct.isSuccess === true && direct.data == null)
  );

  // Tier B: search → pickSearchTitle → a second summary instance with its
  // own key (hooks stay unconditional; only `enabled` moves).
  const search = useWikiSearch(searchQuery(name, club), enabled && directMissed);
  const picked = directMissed ? pickSearchTitle(search.data ?? null, name) : null;
  const rescue = useWikiSummary(picked, enabled && directMissed && picked != null);

  const summary = directMissed ? (rescue.data ?? null) : (direct.data ?? null);
  const verified = verifiedSummary(summary, { name, club });
  const wikiPortrait = verified?.portrait ?? verified?.original ?? null;

  // Faces beyond Wikipedia: FPL only for a Premier League club (the comp
  // is eng.1 — foreign-discovery comps aren't, and TSDB covers them),
  // TSDB only when nothing above produced a face. Both joins re-verify
  // against the club (fplFace within the matched team, tsdbFace on
  // strTeam) — the law holds on every rung.
  const wantsFpl = enabled && comp?.id === 'eng.1' && wikiPortrait == null;
  const fplIndex = useFplIndex(wantsFpl);
  const fplCode = wantsFpl ? fplFace(fplIndex.data ?? null, { name, club }) : null;

  const wantsTsdb = enabled && wikiPortrait == null && fplCode == null;
  const tsdb = useTsdbPlayers(name, wantsTsdb);
  const tsdbUrl = wantsTsdb ? tsdbFace(tsdb.data ?? null, { name, club }) : null;

  const face = faceFor({ wiki: wikiPortrait, fplCode, tsdb: tsdbUrl });
  const resolved = face == null ? null : {
    src: face.code != null ? fplPhotoUrl(face.code) : face.src,
    source: face.source,
  };
  return {
    bio: verified?.extract ?? null,
    face: resolved,
    credit: creditFor(resolved?.source),
  };
}
