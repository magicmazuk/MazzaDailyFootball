import { expect, test } from 'vitest';
import {
  covers, freshEpisodes, highlightLine, isFeatured, isFresh, londonDate,
} from './highlights.js';

// The 23/08 MOTD, as the spike probed it (m0030qgb) — first broadcast
// 22:30 BST Sunday, covering Sunday's eng.1 games.
const motd = {
  comp: { id: 'eng.1' },
  show: 'Match of the Day',
  pid: 'm0030qgb',
  date: '2026-08-23',
  firstBroadcast: '2026-08-23T22:30:00+01:00',
  availableUntil: '2027-08-23T22:00:00+01:00',
  synopsis: "Enzo Maresca's first league game in charge of Manchester City sees him "
    + 'take on Bournemouth… Andoni Iraola takes his Liverpool team to Newcastle…',
  url: 'https://www.bbc.co.uk/iplayer/episode/m0030qgb',
};

const side = (teamId, name) => ({ teamId, name });
const fx = (id, home, away, over = {}) => ({
  id, compId: 'eng.1', status: 'ft', kickoff: '2026-08-23T13:00:00Z',
  home, away, ...over,
});

const cityBournemouth = fx('F1', side('382', 'Manchester City'), side('349', 'AFC Bournemouth'));
const newcastleLiverpool = fx('F2', side('361', 'Newcastle United'), side('364', 'Liverpool'));
// Hypothetical same-day derby twin — exists to trip the guard.
const unitedLiverpool = fx('F3', side('360', 'Manchester United'), side('364', 'Liverpool'));
const day = [cityBournemouth, newcastleLiverpool, unitedLiverpool];

// --- isFresh: within 36 hours of first broadcast, still available ---
test('isFresh: true within 36h of first broadcast, inclusive at the boundary', () => {
  expect(isFresh(motd, new Date('2026-08-24T09:00:00Z'))).toBe(true);
  // firstBroadcast is 21:30Z on the 23rd; exactly 36h later is 09:30Z on the 25th.
  expect(isFresh(motd, new Date('2026-08-25T09:30:00Z'))).toBe(true);
  expect(isFresh(motd, new Date('2026-08-25T09:31:00Z'))).toBe(false);
});

test('isFresh: a future first broadcast is not fresh', () => {
  expect(isFresh(motd, new Date('2026-08-23T21:00:00Z'))).toBe(false);
});

test('isFresh: an expired availableUntil kills freshness; null availableUntil means available', () => {
  const now = new Date('2026-08-24T09:00:00Z');
  expect(isFresh({ ...motd, availableUntil: '2026-08-24T08:00:00Z' }, now)).toBe(false);
  expect(isFresh({ ...motd, availableUntil: null }, now)).toBe(true);
});

test('isFresh: null episode and unparseable firstBroadcast are false, never a throw', () => {
  const now = new Date('2026-08-24T09:00:00Z');
  expect(isFresh(null, now)).toBe(false);
  expect(isFresh(undefined, now)).toBe(false);
  expect(isFresh({ ...motd, firstBroadcast: 'not a date' }, now)).toBe(false);
  expect(isFresh({ ...motd, firstBroadcast: null }, now)).toBe(false);
});

// --- londonDate: the broadcast day, in London ---
test('londonDate: a late BST kickoff crosses into the next London day from UTC', () => {
  expect(londonDate('2026-08-23T23:30:00Z')).toBe('2026-08-24');
  expect(londonDate('2026-08-23T22:30:00+01:00')).toBe('2026-08-23');
});

test('londonDate: winter dates hold GMT; null and garbage give null', () => {
  expect(londonDate('2026-01-10T23:30:00Z')).toBe('2026-01-10');
  expect(londonDate(null)).toBe(null);
  expect(londonDate('not a date')).toBe(null);
});

// --- covers: FT, right league, same London day ---
test('covers: an FT fixture in the show league on the broadcast day is covered', () => {
  expect(covers(motd, cityBournemouth)).toBe(true);
});

test('covers: postponed, live and scheduled fixtures are never covered', () => {
  for (const status of ['postponed', 'live', 'scheduled']) {
    expect(covers(motd, fx('F9', side('1', 'A'), side('2', 'B'), { status }))).toBe(false);
  }
});

test('covers: the wrong league and the wrong day are not covered', () => {
  expect(covers(motd, fx('F9', side('1', 'A'), side('2', 'B'), { compId: 'sco.1' }))).toBe(false);
  expect(covers(motd, fx('F9', side('1', 'A'), side('2', 'B'),
    { kickoff: '2026-08-24T13:00:00Z' }))).toBe(false);
  expect(covers(null, cityBournemouth)).toBe(false);
  expect(covers(motd, null)).toBe(false);
});

// --- isFeatured: both clubs named, with the derby guard ---
test('isFeatured: the probe synopsis features City v Bournemouth and Newcastle v Liverpool', () => {
  expect(isFeatured(motd, cityBournemouth, day)).toBe(true);
  expect(isFeatured(motd, newcastleLiverpool, day)).toBe(true);
});

test('isFeatured: the derby guard — the City mention never features Manchester United', () => {
  // Without the guard, United strips to ['manchester'] and would ride the City mention.
  expect(isFeatured(motd, unitedLiverpool, day)).toBe(false);
});

test('isFeatured: with no derby twin that day, plain token matching stands', () => {
  const noDerby = [cityBournemouth, newcastleLiverpool];
  expect(isFeatured(motd, cityBournemouth, noDerby)).toBe(true);
});

test('isFeatured: "Wolves" in prose features Wolverhampton — the §13.41 ledger retired the old honest miss', () => {
  const wolves = fx('F4', side('380', 'Wolverhampton Wanderers'), side('364', 'Liverpool'));
  const ep = { ...motd, synopsis: 'Wolves entertain Liverpool at Molineux.' };
  expect(isFeatured(ep, wolves, [wolves])).toBe(true);
});

test('isFeatured: whole words only — Wolverhampton does not hide a "ham"', () => {
  const westHam = fx('F5', side('371', 'West Ham United'), side('364', 'Liverpool'));
  const ep = { ...motd, synopsis: 'Wolverhampton welcome Liverpool from out west.' };
  expect(isFeatured(ep, westHam, [westHam])).toBe(false);
});

test('isFeatured: diacritics and punctuation normalise away', () => {
  const stEtienne = fx('F6', side('500', 'Saint-Étienne'), side('364', 'Liverpool'));
  const ep = { ...motd, synopsis: 'Saint-Etienne host Liverpool in the opener.' };
  expect(isFeatured(ep, stEtienne, [stEtienne])).toBe(true);
});

test('isFeatured: a club of nothing but generic tokens falls back to the full-name phrase', () => {
  const athletic = fx('F7', side('501', 'Athletic United'), side('364', 'Liverpool'));
  const named = { ...motd, synopsis: 'Athletic United face Liverpool.' };
  const vague = { ...motd, synopsis: 'An athletic display sinks Liverpool.' };
  expect(isFeatured(named, athletic, [athletic])).toBe(true);
  expect(isFeatured(vague, athletic, [athletic])).toBe(false);
});

test('isFeatured: null synopsis (Sportscene) is never featured', () => {
  expect(isFeatured({ ...motd, synopsis: null }, cityBournemouth, day)).toBe(false);
  expect(isFeatured(null, cityBournemouth, day)).toBe(false);
});

// --- highlightLine: the two copy tiers, no other variants ---
test('highlightLine: featured and covered tiers', () => {
  expect(highlightLine(motd, true)).toBe('Featured on Match of the Day');
  expect(highlightLine(motd, false)).toBe('Highlights · Match of the Day');
  expect(highlightLine(null, true)).toBe(null);
});

// --- freshEpisodes: the filter, order kept ---
test('freshEpisodes: keeps fresh episodes in order; null in gives []', () => {
  const stale = { ...motd, firstBroadcast: '2026-08-20T22:30:00+01:00' };
  const sportscene = { ...motd, pid: 'm0030s0h', show: 'Sportscene',
    firstBroadcast: '2026-08-23T19:30:00+01:00' };
  const now = new Date('2026-08-24T09:00:00Z');
  expect(freshEpisodes([stale, sportscene, motd], now)).toEqual([sportscene, motd]);
  expect(freshEpisodes(null, now)).toEqual([]);
  expect(freshEpisodes(undefined, now)).toEqual([]);
});

// --- known as (spec §13.41): prose nicknames reach the Featured tier ---

const nickFix = (home, away) => ({
  id: 'x', compId: 'eng.1', status: 'ft', kickoff: '2026-08-29T14:00:00Z',
  home: { teamId: 'h', name: home }, away: { teamId: 'a', name: away },
});

const ep = synopsis => ({ comp: { id: 'eng.1' }, show: 'Match of the Day',
  date: '2026-08-29', firstBroadcast: '2026-08-29T21:30:00+01:00',
  availableUntil: null, synopsis, url: 'u' });

test('"Wolves" and "Spurs" in prose now feature their formal clubs', () => {
  const fx = nickFix('Wolverhampton Wanderers', 'Tottenham Hotspur');
  expect(isFeatured(ep('Wolves held Spurs to a goalless draw.'), fx, [fx])).toBe(true);
});

test('"Brighton" alone now features Brighton & Hove Albion', () => {
  const fx = nickFix('Brighton & Hove Albion', 'Everton');
  expect(isFeatured(ep('Brighton swept Everton aside at the Amex.'), fx, [fx])).toBe(true);
});

test('on a derby day, "Man City" in prose features City and never United', () => {
  const city = nickFix('Manchester City', 'AFC Bournemouth');
  const united = nickFix('Manchester United', 'Fulham');
  const episode = ep('Man City beat Bournemouth; Fulham frustrated their neighbours.');
  expect(isFeatured(episode, city, [city, united])).toBe(true);
  expect(isFeatured(episode, united, [city, united])).toBe(false);
});
