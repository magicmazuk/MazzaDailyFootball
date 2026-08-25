// useFixtureHighlight (spec §13.36) — the per-fixture join between the
// highlights reel's episodes and one result: null off the iplayer leagues
// or when no episode covers, otherwise the deep link plus the honest copy
// tier ('Featured on X' only when the synopsis names both clubs, derby-
// guarded across the day's card).
import { renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('../../data/queries.js', () => ({
  useHighlights: vi.fn(() => []),
  useSeasonFixtures: vi.fn(() => ({ data: undefined })),
}));

import { useFixtureHighlight } from './highlight.js';
import { useHighlights, useSeasonFixtures } from '../../data/queries.js';
import { byId } from '../../domain/competitions.js';

const side = name => ({ teamId: name, name, shortName: name, crestUrl: null,
  monogram: name.slice(0, 2).toUpperCase(), colour: null, score: 1 });

const fixture = (over = {}) => ({
  id: 'e1', compId: 'eng.1', kickoff: '2026-08-22T14:00:00Z', status: 'ft',
  minute: null, round: null, venue: null,
  home: side('Arsenal'), away: side('Newcastle United'), ...over,
});

const episode = (over = {}) => ({
  comp: byId('eng.1'), show: 'Match of the Day', pid: 'm0001', date: '2026-08-22',
  firstBroadcast: '2026-08-22T21:30:00+01:00', availableUntil: null,
  synopsis: 'Including Liverpool against Everton.',
  url: 'https://www.bbc.co.uk/iplayer/episode/m0001', ...over,
});

beforeEach(() => {
  useHighlights.mockReturnValue([]);
  useSeasonFixtures.mockReturnValue({ data: undefined });
});

test('returns null when the comp carries no iplayer brand', () => {
  useHighlights.mockReturnValue([episode({ comp: byId('eng.fa') })]);
  const { result } = renderHook(() =>
    useFixtureHighlight(fixture({ compId: 'eng.fa' }), byId('eng.fa')));
  expect(result.current).toBeNull();
});

test('returns null when no episode covers the fixture', () => {
  useHighlights.mockReturnValue([episode({ date: '2026-08-23' })]);
  const { result } = renderHook(() => useFixtureHighlight(fixture(), byId('eng.1')));
  expect(result.current).toBeNull();
});

test('a covered fixture the synopsis does not name gets the Highlights tier and the deep link', () => {
  useHighlights.mockReturnValue([episode()]);
  const { result } = renderHook(() => useFixtureHighlight(fixture(), byId('eng.1')));
  expect(result.current).toEqual({
    url: 'https://www.bbc.co.uk/iplayer/episode/m0001',
    line: 'Highlights · Match of the Day',
  });
});

test('a fixture whose both clubs the synopsis names gets the Featured tier', () => {
  useHighlights.mockReturnValue([episode({
    synopsis: 'Arsenal host Newcastle in the late game.' })]);
  const { result } = renderHook(() => useFixtureHighlight(fixture(), byId('eng.1')));
  expect(result.current.line).toBe('Featured on Match of the Day');
});

test('the derby guard draws on the cached season card: another same-day Manchester demands the full name', () => {
  const mu = fixture({ home: side('Manchester United'), away: side('Arsenal') });
  const mc = fixture({ id: 'e2', home: side('Manchester City'), away: side('Chelsea') });
  useHighlights.mockReturnValue([episode({ synopsis: 'Manchester take on Arsenal.' })]);
  useSeasonFixtures.mockReturnValue({ data: { fixtures: [mu, mc] } });
  const { result } = renderHook(() => useFixtureHighlight(mu, byId('eng.1')));
  // 'manchester' alone is ambiguous with City on the same card — not featured.
  expect(result.current.line).toBe('Highlights · Match of the Day');
});

test('a Manchester on a DIFFERENT day never triggers the guard — only covered fixtures make the card', () => {
  const mu = fixture({ home: side('Manchester United'), away: side('Arsenal') });
  const mcOtherDay = fixture({ id: 'e2', kickoff: '2026-08-23T14:00:00Z',
    home: side('Manchester City'), away: side('Chelsea') });
  useHighlights.mockReturnValue([episode({ synopsis: 'Manchester take on Arsenal.' })]);
  useSeasonFixtures.mockReturnValue({ data: { fixtures: [mu, mcOtherDay] } });
  const { result } = renderHook(() => useFixtureHighlight(mu, byId('eng.1')));
  expect(result.current.line).toBe('Featured on Match of the Day');
});

test('an empty season cache falls back to the fixture itself — the line still prints', () => {
  useHighlights.mockReturnValue([episode({
    synopsis: 'Arsenal host Newcastle in the late game.' })]);
  useSeasonFixtures.mockReturnValue({ data: { fixtures: [] } });
  const { result } = renderHook(() => useFixtureHighlight(fixture(), byId('eng.1')));
  expect(result.current.line).toBe('Featured on Match of the Day');
});

// Review finding (2026-08-25): the season read must be GATED, not merely
// ignored — an ungated useSeasonFixtures({ id: 'none' }) fires a real
// /soccer/none/scoreboard fetch the ESPN allowlist can only 400.
test('the season read is disabled off the iplayer leagues', () => {
  renderHook(() => useFixtureHighlight(fixture({ compId: 'eng.fa' }), byId('eng.fa')));
  expect(useSeasonFixtures).toHaveBeenCalledWith(expect.anything(), { enabled: false });
});

test('the season read is enabled on an iplayer league', () => {
  useHighlights.mockReturnValue([episode()]);
  renderHook(() => useFixtureHighlight(fixture(), byId('eng.1')));
  expect(useSeasonFixtures).toHaveBeenCalledWith(byId('eng.1'), { enabled: true });
});
