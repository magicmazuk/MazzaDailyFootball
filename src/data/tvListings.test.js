import data from './tvListings.json';
import { byId } from '../domain/competitions.js';

const CHANNELS = new Set(['Sky Sports', 'TNT Sports', 'BBC', 'ITV', 'Amazon Prime', 'Premier Sports']);

test('every curated listing is well-formed', () => {
  for (const l of data.listings) {
    expect(byId(l.comp), `unknown comp ${l.comp}`).toBeDefined();
    expect(l.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(l.home.length).toBeGreaterThan(1);
    expect(l.tv.length).toBeGreaterThan(0);
    for (const ch of l.tv) expect(CHANNELS.has(ch), `unknown channel ${ch}`).toBe(true);
  }
});
