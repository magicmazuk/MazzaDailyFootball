// The cup field — entry tiers and survival state (spec §13.10.3). Pure,
// generic derivations over the standard Fixture shape; no UI here. One
// rule (rule 2 below) handles knockouts, group stages (absence from the
// next published round = eliminated) and two-legged ties without any
// special-casing — the singleLeg flag only adds an immediate-elimination
// refinement for competitions where every tie is a single match.

// Distinct fixture.round values, ordered by each round's earliest
// kickoff — never alphabetically or by array order. Fixtures with no
// round are excluded; they carry no stage information to order by.
export function roundOrder(fixtures) {
  const earliest = new Map();
  for (const f of fixtures ?? []) {
    if (f?.round == null) continue;
    const t = new Date(f.kickoff).getTime();
    const cur = earliest.get(f.round);
    if (cur === undefined || t < cur) earliest.set(f.round, t);
  }
  return [...earliest.entries()].sort((a, b) => a[1] - b[1]).map(([round]) => round);
}

function appearedClubs(fixtures) {
  const clubs = new Map();
  for (const f of fixtures ?? []) {
    for (const side of [f?.home, f?.away]) {
      if (side?.teamId == null) continue;
      if (!clubs.has(side.teamId)) clubs.set(side.teamId, side);
    }
  }
  return clubs;
}

// Entry tier = the round of a club's earliest fixture (by kickoff),
// grouped in round order. A competition where everyone enters together
// yields a single tier; staggered entries (byes, seeded waves) yield one
// tier per wave. A round with no first-time entrants — every club in it
// already appeared earlier — is omitted rather than emitted empty.
export function entryTiers(fixtures) {
  const list = fixtures ?? [];
  const firstSeen = new Map(); // teamId -> { side, kickoff, round }
  for (const f of list) {
    const t = new Date(f.kickoff).getTime();
    for (const side of [f.home, f.away]) {
      if (side?.teamId == null) continue;
      const cur = firstSeen.get(side.teamId);
      if (!cur || t < cur.kickoff) firstSeen.set(side.teamId, { side, kickoff: t, round: f.round });
    }
  }
  const byRound = new Map();
  for (const { side, round } of firstSeen.values()) {
    if (round == null) continue;
    if (!byRound.has(round)) byRound.set(round, []);
    byRound.get(round).push(side);
  }
  return roundOrder(list)
    .filter(round => byRound.has(round))
    .map(round => ({
      round,
      clubs: byRound.get(round).sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

// A completed 'ft' fixture's decidable winner: a score difference, or
// equal scores broken by a penalty shootout recorded on both sides.
// Draws (and shootouts with no recorded scores) are undecidable: null.
function decidedWinner(f) {
  if (f?.status !== 'ft') return null;
  const h = f.home, a = f.away;
  if (h?.score == null || a?.score == null) return null;
  if (h.score !== a.score) return h.score > a.score ? 'home' : 'away';
  if (h.penaltyScore != null && a.penaltyScore != null && h.penaltyScore !== a.penaltyScore) {
    return h.penaltyScore > a.penaltyScore ? 'home' : 'away';
  }
  return null;
}

export function survivalState(fixtures, { singleLeg = false } = {}) {
  const list = fixtures ?? [];
  const order = roundOrder(list);
  const roundIndex = new Map(order.map((r, i) => [r, i]));
  const clubs = appearedClubs(list);

  const fixturesByRound = new Map();
  for (const f of list) {
    if (f.round == null) continue;
    if (!fixturesByRound.has(f.round)) fixturesByRound.set(f.round, []);
    fixturesByRound.get(f.round).push(f);
  }
  const roundComplete = round => {
    const fx = fixturesByRound.get(round) ?? [];
    return fx.length > 0 && fx.every(f => f.status === 'ft' || f.status === 'canceled');
  };

  // Each club's last round of appearance, by round order — not by raw
  // kickoff — since a round groups every leg/group fixture together.
  const lastRoundIdx = new Map();
  for (const f of list) {
    if (f.round == null) continue;
    const idx = roundIndex.get(f.round);
    for (const side of [f.home, f.away]) {
      if (side?.teamId == null) continue;
      const cur = lastRoundIdx.get(side.teamId);
      if (cur === undefined || idx > cur) lastRoundIdx.set(side.teamId, idx);
    }
  }

  const outTeamIds = new Set();
  const outByRound = new Map();
  const markOut = (round, side) => {
    if (side?.teamId == null || outTeamIds.has(side.teamId)) return;
    outTeamIds.add(side.teamId);
    if (!outByRound.has(round)) outByRound.set(round, new Map());
    outByRound.get(round).set(side.teamId, side);
  };

  // Rule 4: a decided, complete final crowns a champion and eliminates
  // its loser — independent of the singleLeg flag.
  let champion = null;
  let championTeamId = null;
  const lastRound = order[order.length - 1];
  if (lastRound === 'final') {
    const fx = fixturesByRound.get('final') ?? [];
    if (fx.length === 1) {
      const [f] = fx;
      const winner = decidedWinner(f);
      if (winner) {
        const winnerSide = winner === 'home' ? f.home : f.away;
        const loserSide = winner === 'home' ? f.away : f.home;
        champion = winnerSide;
        championTeamId = winnerSide.teamId;
        markOut('final', loserSide);
      }
    }
  }

  // Rule 3: singleLeg competitions eliminate a decided loser immediately,
  // without waiting for its round to complete or a later round to exist.
  // A replay/re-ordered match means the same pairing can meet more than
  // once within a round — group decisive meetings by round + pairing
  // (order-independent) and let only the chronologically LAST decisive
  // meeting of each pairing produce a loser, so an overturned earlier
  // leg never eliminates both sides.
  if (singleLeg) {
    const lastDecisive = new Map(); // `${round}|${pairKey}` -> { f, t, winner }
    for (const f of list) {
      if (f.round == null) continue;
      const h = f.home, a = f.away;
      if (h?.teamId == null || a?.teamId == null) continue;
      const winner = decidedWinner(f);
      if (!winner) continue;
      const pairKey = [h.teamId, a.teamId].sort().join('|');
      const key = `${f.round}|${pairKey}`;
      const t = new Date(f.kickoff).getTime();
      const cur = lastDecisive.get(key);
      if (!cur || t > cur.t) lastDecisive.set(key, { f, t, winner });
    }
    for (const { f, winner } of lastDecisive.values()) {
      markOut(f.round, winner === 'home' ? f.away : f.home);
    }
  }

  // Rule 2: a club is out when its last round of appearance is complete
  // and at least one later round has been published. Win/loss within the
  // fixture is irrelevant here — absence from what comes next is what
  // defines elimination, which is what makes this rule work for groups
  // and two-legged ties without any special-casing.
  for (const round of order) {
    const idx = roundIndex.get(round);
    if (idx >= order.length - 1) continue; // no later round published yet
    if (!roundComplete(round)) continue;
    for (const [teamId, li] of lastRoundIdx.entries()) {
      if (li !== idx || outTeamIds.has(teamId)) continue;
      markOut(round, clubs.get(teamId));
    }
  }

  const inClubs = [...clubs.values()]
    .filter(side => !outTeamIds.has(side.teamId) && side.teamId !== championTeamId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const out = order
    .filter(round => outByRound.has(round))
    .map(round => ({
      round,
      clubs: [...outByRound.get(round).values()].sort((a, b) => a.name.localeCompare(b.name)),
    }));

  return { in: inClubs, out, champion };
}

// Tier/round labels are prettified in the UI via round.js's
// prettifyRound(). For the slugs it deliberately returns null for
// (league/group phases, or any slug it doesn't recognise), this renders
// the raw slug title-cased instead of hiding the label entirely.
export function fallbackRoundLabel(round) {
  if (!round) return '';
  return round
    .split('-')
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
