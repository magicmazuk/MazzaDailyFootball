// The TV desk check: every curated listing must match a real fixture
// (comp + UTC date + home, the applyTv matching rules), and upcoming
// fixtures in the next window are surfaced for curation. Runs against
// the prod proxies — the same data the app reads.
import { readFileSync } from 'node:fs';

const BASE = 'https://mazza-daily-football.vercel.app';
const { listings } = JSON.parse(readFileSync('src/data/tvListings.json', 'utf8'));
const normalize = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// comps that appear in listings, plus the ones we curate for
const comps = [...new Set([...listings.map(l => l.comp),
  'eng.1', 'sco.1', 'uefa.champions', 'uefa.europa', 'eng.league_cup'])];
// qualifying rounds live under separate ESPN codes; the registry folds
// them into the parent comp, so listings carry the PARENT id
const QUAL = { 'uefa.champions_qual': 'uefa.champions', 'uefa.europa_qual': 'uefa.europa' };
comps.push(...Object.keys(QUAL));

const day = d => d.toISOString().slice(0, 10);
const TODAY = day(new Date());
const WINDOW_END = day(new Date(Date.now() + 35 * 86400e3));

const fixtures = [];
for (const comp of comps) {
  // whole-season scoreboard, same route the app's season queries use
  const url = `${BASE}/api/espn/apis/site/v2/sports/soccer/${comp}/scoreboard?dates=20260701-20270630&limit=500`;
  try {
    const r = await fetch(url);
    if (!r.ok) { console.log(`!! ${comp}: HTTP ${r.status}`); continue; }
    const j = await r.json();
    for (const e of j.events ?? []) {
      const c = e.competitions?.[0];
      const home = c?.competitors?.find(x => x.homeAway === 'home')?.team?.displayName;
      const away = c?.competitors?.find(x => x.homeAway === 'away')?.team?.displayName;
      fixtures.push({ comp: QUAL[comp] ?? comp, date: (e.date ?? '').slice(0, 10), home, away, kick: e.date });
    }
  } catch (err) { console.log(`!! ${comp}: ${err.message}`); }
}
console.log(`fetched ${fixtures.length} fixtures across ${comps.length} comps\n`);

// 1 — orphaned listings (postponed/moved matches would show here)
console.log('— listings vs reality —');
let orphans = 0;
for (const l of listings) {
  const hit = fixtures.find(f =>
    f.comp === l.comp && f.date === l.date && normalize(f.home) === normalize(l.home));
  if (!hit) { orphans++; console.log(`ORPHAN  ${l.date} ${l.comp} ${l.home} ${JSON.stringify(l.tv)}`); }
}
if (!orphans) console.log(`all ${listings.length} listings match a live fixture`);

// 2 — the curation window: upcoming fixtures with no listing
console.log(`\n— unlisted fixtures ${TODAY} → ${WINDOW_END} —`);
const listed = new Set(listings.map(l => `${l.comp}|${l.date}|${normalize(l.home)}`));
const upcoming = fixtures
  .filter(f => f.date >= TODAY && f.date <= WINDOW_END)
  .sort((a, b) => a.kick.localeCompare(b.kick));
for (const f of upcoming) {
  const key = `${f.comp}|${f.date}|${normalize(f.home)}`;
  console.log(`${listed.has(key) ? '  listed' : 'UNLISTED'}  ${f.date} ${f.comp.padEnd(16)} ${f.home} v ${f.away}`);
}
console.log(`\ncoverage ends: ${listings.map(l => l.date).sort().at(-1)}`);
