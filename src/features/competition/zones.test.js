import { zoneFor, ZONE_META } from './zones.js';
import { byId } from '../../domain/competitions.js';

test('zoneFor reads the competition zone map', () => {
  expect(zoneFor(byId('sco.1'), 1)).toBe('ucl');
  expect(zoneFor(byId('sco.1'), 5)).toBeNull();
  expect(zoneFor(byId('sco.1'), 12)).toBe('rel');
  expect(zoneFor(byId('uefa.champions'), 24)).toBe('po');
});

test('every zone key used by any competition has metadata', () => {
  expect(Object.keys(ZONE_META).sort()).toEqual(['adv', 'po', 'promo', 'rel', 'ucl', 'uecl']);
  for (const meta of Object.values(ZONE_META)) {
    expect(meta.colour).toMatch(/^#/);
    expect(meta.label.length).toBeGreaterThan(2);
  }
});
