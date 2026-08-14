// Case-insensitive club search across every competition's team list,
// deduped by id (the same club appears in league + cups + Europe).
export function searchTeams(teams, q) {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const seen = new Set();
  const out = [];
  for (const t of teams) {
    if (!t.name.toLowerCase().includes(needle) || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length === 12) break;
  }
  return out;
}
