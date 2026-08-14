import { searchTeams } from './searchTeams.js';

const t = (id, name) => ({ id, name, shortName: name, crestUrl: null, monogram: 'XX', colour: null });
const teams = [
  t('256', 'Celtic'), t('257', 'Rangers'), t('261', 'Dundee'), t('264', 'Dundee United'),
  t('256', 'Celtic'), // duplicate id from a second competition
];

test('case-insensitive substring match', () => {
  expect(searchTeams(teams, 'dun').map(x => x.name)).toEqual(['Dundee', 'Dundee United']);
  expect(searchTeams(teams, 'CELT').map(x => x.name)).toEqual(['Celtic']);
});

test('dedupes by id across competitions', () => {
  expect(searchTeams(teams, 'celtic')).toHaveLength(1);
});

test('under two characters returns nothing', () => {
  expect(searchTeams(teams, 'c')).toEqual([]);
  expect(searchTeams(teams, '')).toEqual([]);
});

test('caps at 12 results', () => {
  const many = Array.from({ length: 30 }, (_, i) => t(String(i), `Team ${i}`));
  expect(searchTeams(many, 'team')).toHaveLength(12);
});
