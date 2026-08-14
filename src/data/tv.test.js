import { applyTv, tvShortLabel } from './tv.js';

const side = name => ({ teamId: name, name, score: null });
const fx = (compId, kickoff, h, a) => ({ id: h, compId, kickoff, status: 'scheduled', home: side(h), away: side(a) });

const listings = [
  { comp: 'sco.1', date: '2026-08-22', home: 'St Mirren', tv: ['Sky Sports'] },
  { comp: 'eng.1', date: '2026-08-22', home: 'Manchester United', tv: ['TNT Sports', 'Amazon Prime'] },
];

test('matches on comp + kickoff date + normalized home name', () => {
  const out = applyTv([
    fx('sco.1', '2026-08-22T16:30:00Z', 'St Mirren', 'Rangers'),
    fx('sco.1', '2026-08-22T14:00:00Z', 'Kilmarnock', 'Hibernian'),
  ], listings);
  expect(out[0].tv).toEqual(['Sky Sports']);
  expect(out[1].tv).toEqual([]);
});

test('normalization shrugs off case and punctuation', () => {
  const out = applyTv([fx('eng.1', '2026-08-22T11:30:00Z', 'Manchester United', 'Hull City')],
    [{ comp: 'eng.1', date: '2026-08-22', home: 'manchester-united', tv: ['BBC'] }]);
  expect(out[0].tv).toEqual(['BBC']);
});

test('wrong date or comp never matches', () => {
  const out = applyTv([fx('sco.1', '2026-08-23T14:00:00Z', 'St Mirren', 'Rangers')], listings);
  expect(out[0].tv).toEqual([]);
});

test('empty listings leave every fixture with tv: []', () => {
  const out = applyTv([fx('sco.1', '2026-08-22T14:00:00Z', 'Celtic', 'Dundee')], []);
  expect(out[0].tv).toEqual([]);
});

test('short labels', () => {
  expect(tvShortLabel('Sky Sports')).toBe('Sky');
  expect(tvShortLabel('TNT Sports')).toBe('TNT');
  expect(tvShortLabel('BBC')).toBe('BBC');
  expect(tvShortLabel('ITV')).toBe('ITV');
  expect(tvShortLabel('Amazon Prime')).toBe('Prime');
  expect(tvShortLabel('Unknown Channel')).toBe('Unknown Channel');
});
