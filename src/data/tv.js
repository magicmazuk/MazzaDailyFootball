// TV badges from the curated file (spec §13.3). The provider seam:
// applyTv is pure, and the file could be swapped for an API response
// without touching anything downstream.
import data from './tvListings.json';

export const TV_LISTINGS = data.listings;

const SHORT = {
  'Sky Sports': 'Sky',
  // the EFL deal's stream-only ties: a distinct badge, never a promise
  // of a linear channel
  'Sky Sports+': 'Sky+',
  'TNT Sports': 'TNT',
  'BBC': 'BBC',
  'ITV': 'ITV',
  'Amazon Prime': 'Prime',
  'Premier Sports': 'Premier',
  'Premier Player': 'Player',
};

export const tvShortLabel = channel => SHORT[channel] ?? channel;

const normalize = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function applyTv(fixtures, listings = TV_LISTINGS) {
  if (!listings.length) return fixtures.map(f => ({ ...f, tv: [] }));
  return fixtures.map(f => {
    const hit = listings.find(l =>
      l.comp === f.compId &&
      l.date === (f.kickoff ?? '').slice(0, 10) &&
      normalize(l.home) === normalize(f.home?.name));
    return { ...f, tv: hit?.tv ?? [] };
  });
}
