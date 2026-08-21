import { expect, test } from 'vitest';
import { wosflCrest, enrichCrests, crestIndexFrom } from './crests.js';

test('curated WoSFL crests resolve by teamId; everyone else stays monogram-null', () => {
  expect(wosflCrest('105928322')).toBe('/crests/wosfl/105928322.png'); // Threave Rovers
  expect(wosflCrest('294941809')).toBe('/crests/wosfl/294941809.png'); // Bonnyton Thistle
  expect(wosflCrest('147611871')).toBe('/crests/wosfl/147611871.png'); // Bellshill — badge supplied by the editor himself
});

test('an ESPN teams payload becomes a normalised name→logo index', () => {
  const espnTeams = { sports: [{ leagues: [{ teams: [
    { team: { displayName: 'Alloa Athletic', logos: [{ href: 'https://a.espncdn.com/alloa.png' }] } },
    { team: { displayName: 'Cove Rangers', logos: [] } },
  ] }] }] };
  const idx = crestIndexFrom(espnTeams);
  expect(idx.get('alloaathletic')).toBe('https://a.espncdn.com/alloa.png');
  expect(idx.has('coverangers')).toBe(false); // no logo, no entry
});

test('enrichment fills only missing crests, by strict normalised name — no fuzzy guesses', () => {
  const idx = new Map([['alloaathletic', 'https://a.espncdn.com/alloa.png']]);
  const fixtures = [{
    home: { name: 'Alloa Athletic', crestUrl: null },
    away: { name: 'Kelty Hearts', crestUrl: null },
  }, {
    home: { name: 'Alloa Athletic', crestUrl: 'https://already.png' },
    away: { name: 'Somebody', crestUrl: null },
  }];
  const out = enrichCrests(fixtures, idx);
  expect(out[0].home.crestUrl).toBe('https://a.espncdn.com/alloa.png');
  expect(out[0].away.crestUrl).toBeNull();          // unmatched stays honest
  expect(out[1].home.crestUrl).toBe('https://already.png'); // never overwrites
});
