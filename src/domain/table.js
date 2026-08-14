// League table computed from results — the tables for the two
// BBC-sourced leagues, which have no standings endpoint (spec §3.3).
// 3/1/0 points; sort points → goal difference → goals for → name.
export function computeTable(fixtures) {
  const rows = new Map();
  const rowFor = side => {
    if (!rows.has(side.teamId)) {
      rows.set(side.teamId, {
        teamId: side.teamId, name: side.name, crestUrl: side.crestUrl ?? null,
        monogram: side.monogram, played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, deduction: 0,
      });
    }
    return rows.get(side.teamId);
  };

  for (const f of fixtures) {
    if (f.status !== 'ft' || f.home.score == null || f.away.score == null) continue;
    const h = rowFor(f.home);
    const a = rowFor(f.away);
    h.played += 1; a.played += 1;
    h.goalsFor += f.home.score; h.goalsAgainst += f.away.score;
    a.goalsFor += f.away.score; a.goalsAgainst += f.home.score;
    if (f.home.score > f.away.score) { h.won += 1; h.points += 3; a.lost += 1; }
    else if (f.home.score < f.away.score) { a.won += 1; a.points += 3; h.lost += 1; }
    else { h.drawn += 1; a.drawn += 1; h.points += 1; a.points += 1; }
  }

  const list = [...rows.values()];
  for (const r of list) r.goalDifference = r.goalsFor - r.goalsAgainst;
  list.sort((x, y) =>
    y.points - x.points || y.goalDifference - x.goalDifference ||
    y.goalsFor - x.goalsFor || x.name.localeCompare(y.name));
  return list.map((r, i) => ({ ...r, position: i + 1 }));
}
