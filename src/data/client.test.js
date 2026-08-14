import { espnUrl, bbcUrl } from './client.js';

test('espnUrl composes path and query', () => {
  expect(espnUrl('/apis/site/v2/sports/soccer/sco.1/scoreboard', { dates: '20260701-20270630', limit: 500 }))
    .toBe('/api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=20260701-20270630&limit=500');
  expect(espnUrl('/apis/v2/sports/soccer/eng.1/standings', { season: 2026 }))
    .toBe('/api/espn/apis/v2/sports/soccer/eng.1/standings?season=2026');
});

test('bbcUrl composes the query form', () => {
  expect(bbcUrl('scottish-league-one', '2026-07-01', '2027-06-30'))
    .toBe('/api/bbc?tournament=scottish-league-one&start=2026-07-01&end=2027-06-30');
});
