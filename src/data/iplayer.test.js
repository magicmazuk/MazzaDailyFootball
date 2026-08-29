import { expect, test } from 'vitest';
import { adaptEpisode, adaptLastEpisode, adaptUpcoming, episodeUrl } from './iplayer.js';

// Fixtures mirror the ledger's live-probed payload truths (2026-08-25):
// the first broadcast in episodes/last.json MAY BE A REPEAT AIRING of the
// latest episode — a Monday 08:00 repeat of Sunday's MOTD — so the episode
// date must key off programme.first_broadcast_date, NEVER schedule_date
// and NEVER is_repeat (that flags the airing, not the episode).
const lastJsonWithMondayRepeat = {
  broadcasts: [
    {
      is_repeat: true,
      schedule_date: '2026-08-24',
      start: '2026-08-24T08:00:00+01:00',
      end: '2026-08-24T09:20:00+01:00',
      programme: {
        pid: 'm002abcd',
        title: 'MOTD2',
        first_broadcast_date: '2026-08-23T22:30:00+01:00',
        available_until: '2026-09-22T22:59:00+01:00',
        short_synopsis: 'Mark Chapman presents highlights of the day’s Premier League games.',
      },
    },
  ],
};

test('adaptLastEpisode dates the episode by first_broadcast_date (London), never the repeat airing’s schedule_date', () => {
  const ep = adaptLastEpisode(lastJsonWithMondayRepeat);
  expect(ep).toEqual({
    pid: 'm002abcd',
    title: 'MOTD2',
    date: '2026-08-23', // Sunday 22:30 +01:00 — NOT the Monday the repeat aired
    firstBroadcast: '2026-08-23T22:30:00+01:00',
    availableUntil: '2026-09-22T22:59:00+01:00',
    synopsis: 'Mark Chapman presents highlights of the day’s Premier League games.',
  });
});

test('adaptLastEpisode tolerates a programme missing title, available_until and synopsis', () => {
  const ep = adaptLastEpisode({
    broadcasts: [{ programme: { pid: 'm0030s0h', first_broadcast_date: '2026-08-22T22:00:00+01:00' } }],
  });
  expect(ep.pid).toBe('m0030s0h');
  expect(ep.title).toBeNull();
  expect(ep.date).toBe('2026-08-22');
  expect(ep.availableUntil).toBeNull();
  expect(ep.synopsis).toBeNull();
});

test('adaptLastEpisode returns null when the broadcasts array is missing, empty, or carries no programme', () => {
  expect(adaptLastEpisode({})).toBeNull();
  expect(adaptLastEpisode({ broadcasts: [] })).toBeNull();
  expect(adaptLastEpisode({ broadcasts: [{ is_repeat: false }] })).toBeNull();
  expect(adaptLastEpisode(null)).toBeNull();
  expect(adaptLastEpisode(undefined)).toBeNull();
});

test('adaptEpisode prefers long_synopsis, falling through medium to short', () => {
  const programme = {
    pid: 'm002abcd',
    first_broadcast_date: '2026-08-23T22:30:00+01:00',
    short_synopsis: 'short',
    medium_synopsis: 'medium',
    long_synopsis: 'Arsenal host Manchester City and Celtic travel to Tynecastle.',
  };
  expect(adaptEpisode({ programme }).synopsis)
    .toBe('Arsenal host Manchester City and Celtic travel to Tynecastle.');
  expect(adaptEpisode({ programme }).date).toBe('2026-08-23');
});

test('adaptEpisode falls back to short_synopsis alone (the Sportscene case — no long_synopsis, verified m0030s0h)', () => {
  const ep = adaptEpisode({
    programme: {
      pid: 'm0030s0h',
      first_broadcast_date: '2026-08-22T22:00:00+01:00',
      short_synopsis: 'Premiership highlights.',
    },
  });
  expect(ep).toEqual({ pid: 'm0030s0h', date: '2026-08-22', synopsis: 'Premiership highlights.' });
});

test('adaptEpisode returns null on missing programme or nullish input; a malformed date becomes a null date, never a throw', () => {
  expect(adaptEpisode({})).toBeNull();
  expect(adaptEpisode(null)).toBeNull();
  expect(adaptEpisode(undefined)).toBeNull();
  const ep = adaptEpisode({ programme: { pid: 'x1y2z3w4', first_broadcast_date: 'not a date' } });
  expect(ep.date).toBeNull();
  expect(adaptEpisode({ programme: { pid: 'x1y2z3w4' } }).date).toBeNull();
});

test('a winter first_broadcast_date lands on its London calendar day (GMT, not the machine zone)', () => {
  const ep = adaptEpisode({
    programme: { pid: 'm002wxyz', first_broadcast_date: '2026-12-19T22:30:00Z' },
  });
  expect(ep.date).toBe('2026-12-19');
});

test('episodeUrl builds the verified iPlayer deep link', () => {
  expect(episodeUrl('m002abcd')).toBe('https://www.bbc.co.uk/iplayer/episode/m002abcd');
});

// --- adaptUpcoming (spec §13.43, the airtime foot) --------------------------
// Fixtures mirror the live-probed episodes/upcoming.json truth (2026-08-29):
// each broadcasts[] entry carries start/end + service + programme. The
// channel is service.title — the real feed has NO service.name — and the
// brand's name lives at programme.display_titles (PLURAL; the singular
// display_title belongs to {pid}.json detail). programme.title is just the
// episode's date string ("29/08/2026").
const upcomingJson = {
  broadcasts: [
    {
      is_repeat: false, is_blanked: false, schedule_date: '2026-08-29',
      start: '2026-08-29T22:25:00+01:00', end: '2026-08-29T23:35:00+01:00', duration: 4200,
      service: { type: 'tv', id: 'bbc_one', key: 'bbcone', title: 'BBC One' },
      programme: {
        type: 'episode', pid: 'm003116q', title: '29/08/2026',
        display_titles: { title: 'Match of the Day', subtitle: '2026/27, 29/08/2026' },
        first_broadcast_date: '2026-08-29T22:25:00+01:00',
        short_synopsis: 'Gabby Logan presents highlights of Saturday’s Premier League matches.',
      },
    },
    {
      is_repeat: true, is_blanked: false, schedule_date: '2026-08-30',
      start: '2026-08-30T08:50:00+01:00', end: '2026-08-30T10:00:00+01:00', duration: 4200,
      service: { type: 'tv', id: 'bbc_one', key: 'bbcone', title: 'BBC One' },
      programme: {
        type: 'episode', pid: 'm003116q', title: '29/08/2026',
        display_titles: { title: 'Match of the Day', subtitle: '2026/27, 29/08/2026' },
        first_broadcast_date: '2026-08-29T22:25:00+01:00',
        short_synopsis: 'Gabby Logan presents highlights of Saturday’s Premier League matches.',
      },
    },
  ],
};

test('adaptUpcoming maps every broadcast with a programme to pid/title/start/end/channel', () => {
  expect(adaptUpcoming(upcomingJson)).toEqual([
    {
      pid: 'm003116q', title: 'Match of the Day',
      start: '2026-08-29T22:25:00+01:00', end: '2026-08-29T23:35:00+01:00',
      channel: 'BBC One',
    },
    {
      pid: 'm003116q', title: 'Match of the Day',
      start: '2026-08-30T08:50:00+01:00', end: '2026-08-30T10:00:00+01:00',
      channel: 'BBC One',
    },
  ]);
});

test('adaptUpcoming falls back to programme.title without display_titles, nulls a missing service or times, and skips programme-less entries', () => {
  const sparse = {
    broadcasts: [
      { start: '2026-08-29T19:15:00+01:00', end: '2026-08-29T20:15:00+01:00' }, // no programme — skipped
      { programme: { pid: 'm00312s3', title: '29/08/2026' } },
    ],
  };
  expect(adaptUpcoming(sparse)).toEqual([
    { pid: 'm00312s3', title: '29/08/2026', start: null, end: null, channel: null },
  ]);
});

test('adaptUpcoming is [] on missing or malformed payloads, never a throw', () => {
  expect(adaptUpcoming({})).toEqual([]);
  expect(adaptUpcoming({ broadcasts: [] })).toEqual([]);
  expect(adaptUpcoming({ broadcasts: 'not a list' })).toEqual([]);
  expect(adaptUpcoming(null)).toEqual([]);
  expect(adaptUpcoming(undefined)).toEqual([]);
});
