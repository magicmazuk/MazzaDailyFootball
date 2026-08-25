// useDossier (spec §13.37) — the composition hook behind the D-B profile
// column. Orchestrates the identity flow over the four raw fetch hooks
// (mocked here, the useHighlights-harness style): direct title → the
// disambiguation/miss search fallback → verifiedSummary (the law) → the
// face ladder (wiki portrait → FPL for eng.1 → TSDB last). Hooks are
// called unconditionally — gating is entirely via `enabled` arguments,
// which these tests pin call-by-call.
import { renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('../../data/queries.js', () => ({
  useWikiSummary: vi.fn(() => ({ data: undefined })),
  useWikiSearch: vi.fn(() => ({ data: undefined })),
  useFplIndex: vi.fn(() => ({ data: undefined })),
  useTsdbPlayers: vi.fn(() => ({ data: undefined })),
}));

import { useDossier } from './dossier.js';
import {
  useFplIndex, useTsdbPlayers, useWikiSearch, useWikiSummary,
} from '../../data/queries.js';
import { fplPhotoUrl } from '../../data/dossier.js';

const comp = { id: 'sco.1', name: 'Scottish Premiership', source: 'espn' };

// The probe truths, adapted shape (Task 1's adapter output).
const forrest = {
  title: 'James Forrest (footballer, born 1991)',
  kind: 'standard',
  extract: 'James Forrest is a Scottish professional footballer who plays '
    + 'as a winger for Scottish Premiership club Celtic.',
  portrait: 'https://upload.wikimedia.org/thumb/forrest.jpg',
  original: 'https://upload.wikimedia.org/forrest.jpg',
};

const fplIndex = {
  teams: [{ id: 3, name: 'Newcastle' }],
  players: [{ code: 232826, first: 'Anthony', second: 'Gordon', web: 'Gordon', team: 3 }],
};

const tsdbBraga = {
  name: 'Cláudio Braga', team: 'Aberdeen FC',
  cutout: 'https://r2.thesportsdb.com/braga-cutout.png',
  thumb: 'https://r2.thesportsdb.com/braga-thumb.png',
};

// Disabled-shaped stubs before every test; each test opts hooks in.
beforeEach(() => {
  useWikiSummary.mockReset().mockReturnValue({ data: undefined });
  useWikiSearch.mockReset().mockReturnValue({ data: undefined });
  useFplIndex.mockReset().mockReturnValue({ data: undefined });
  useTsdbPlayers.mockReset().mockReturnValue({ data: undefined });
});

test('direct hit: a verified summary yields extract, wiki portrait and the Commons credit', () => {
  useWikiSummary.mockImplementation(title => (
    title === 'James Forrest' ? { data: forrest, isSuccess: true } : { data: undefined }));
  const { result } = renderHook(() =>
    useDossier({ id: 'p1', name: 'James Forrest' }, comp, 'Celtic'));

  expect(result.current.bio).toBe(forrest.extract);
  expect(result.current.face).toEqual({ src: forrest.portrait, source: 'wikimedia' });
  expect(result.current.credit).toBe('Wikimedia Commons');
  // The direct title resolved — the search fallback never arms.
  expect(useWikiSearch).toHaveBeenCalledWith(expect.anything(), false);
});

test('disambiguation falls back through search to the picked title, then verifies', () => {
  useWikiSummary.mockImplementation(title => {
    if (title === 'James Forrest') {
      return {
        data: { ...forrest, title: 'James Forrest', kind: 'disambiguation', extract: 'James Forrest may refer to:' },
        isSuccess: true,
      };
    }
    if (title === 'James Forrest (footballer, born 1991)') return { data: forrest, isSuccess: true };
    return { data: undefined };
  });
  useWikiSearch.mockImplementation((q, enabled) => (
    enabled ? { data: ['Celtic F.C.', 'James Forrest (footballer, born 1991)'], isSuccess: true }
      : { data: undefined }));

  const { result } = renderHook(() =>
    useDossier({ id: 'p1', name: 'James Forrest' }, comp, 'Celtic'));

  expect(useWikiSearch).toHaveBeenCalledWith('James Forrest footballer Celtic', true);
  expect(useWikiSummary).toHaveBeenCalledWith('James Forrest (footballer, born 1991)', true);
  expect(result.current.bio).toBe(forrest.extract);
  expect(result.current.face).toEqual({ src: forrest.portrait, source: 'wikimedia' });
});

test('a missing page (the direct query errors) is a miss — the search fallback arms', () => {
  useWikiSummary.mockImplementation(title => {
    if (title === 'James Forrest') return { data: undefined, isError: true };
    if (title === 'James Forrest (footballer, born 1991)') return { data: forrest, isSuccess: true };
    return { data: undefined };
  });
  useWikiSearch.mockImplementation((q, enabled) => (
    enabled ? { data: ['James Forrest (footballer, born 1991)'], isSuccess: true } : { data: undefined }));

  const { result } = renderHook(() =>
    useDossier({ id: 'p1', name: 'James Forrest' }, comp, 'Celtic'));

  expect(useWikiSearch).toHaveBeenCalledWith('James Forrest footballer Celtic', true);
  expect(result.current.bio).toBe(forrest.extract);
});

test('THE LAW: an unverified extract (wrong club) yields null bio, null face, null credit', () => {
  const rangersMan = {
    ...forrest,
    extract: 'James Forrest is a footballer who plays for Rangers.',
  };
  useWikiSummary.mockImplementation(title => (
    title === 'James Forrest' ? { data: rangersMan, isSuccess: true } : { data: undefined }));

  const { result } = renderHook(() =>
    useDossier({ id: 'p1', name: 'James Forrest' }, comp, 'Celtic'));

  expect(result.current).toEqual({ bio: null, face: null, credit: null });
});

test('a verified wiki portrait wins outright — FPL and TSDB never arm', () => {
  useWikiSummary.mockImplementation(title => (
    title === 'James Forrest' ? { data: forrest, isSuccess: true } : { data: undefined }));
  renderHook(() => useDossier({ id: 'p1', name: 'James Forrest' }, comp, 'Celtic'));

  expect(useFplIndex).toHaveBeenCalledWith(false);
  expect(useTsdbPlayers).toHaveBeenCalledWith('James Forrest', false);
});

test('eng.1 with a portrait-less verified summary falls to the FPL headshot, resolved to a URL', () => {
  const gordon = {
    ...forrest,
    title: 'Anthony Gordon',
    extract: 'Anthony Gordon is an English winger who plays for Newcastle United.',
    portrait: null,
    original: null,
  };
  useWikiSummary.mockImplementation(title => (
    title === 'Anthony Gordon' ? { data: gordon, isSuccess: true } : { data: undefined }));
  useFplIndex.mockImplementation(enabled => (
    enabled ? { data: fplIndex, isSuccess: true } : { data: undefined }));

  const { result } = renderHook(() =>
    useDossier({ id: 'p2', name: 'Anthony Gordon' },
      { id: 'eng.1', name: 'Premier League', source: 'espn' }, 'Newcastle United'));

  expect(useFplIndex).toHaveBeenCalledWith(true);
  expect(result.current.bio).toBe(gordon.extract);
  expect(result.current.face).toEqual({ src: fplPhotoUrl(232826), source: 'premier-league' });
  expect(result.current.credit).toBe('Premier League');
});

test('off eng.1, TSDB is the last face standing (FPL never arms)', () => {
  const braga = {
    ...forrest,
    title: 'Cláudio Braga',
    extract: 'Claudio Braga is a forward who plays for Scottish club Aberdeen.',
    portrait: null,
    original: null,
  };
  useWikiSummary.mockImplementation(title => (
    title === 'Cláudio Braga' ? { data: braga, isSuccess: true } : { data: undefined }));
  useTsdbPlayers.mockImplementation((name, enabled) => (
    enabled ? { data: [tsdbBraga], isSuccess: true } : { data: undefined }));

  const { result } = renderHook(() =>
    useDossier({ id: 'p3', name: 'Cláudio Braga' }, comp, 'Aberdeen'));

  expect(useFplIndex).toHaveBeenCalledWith(false);
  expect(useTsdbPlayers).toHaveBeenCalledWith('Cláudio Braga', true);
  expect(result.current.face).toEqual({ src: tsdbBraga.cutout, source: 'thesportsdb' });
  expect(result.current.credit).toBe('TheSportsDB');
});

test('no club context → no dossier: everything null and every fetch hook armed false', () => {
  const { result } = renderHook(() =>
    useDossier({ id: 'p1', name: 'James Forrest' }, comp, null));

  expect(result.current).toEqual({ bio: null, face: null, credit: null });
  for (const call of useWikiSummary.mock.calls) expect(call[1]).toBe(false);
  for (const call of useWikiSearch.mock.calls) expect(call[1]).toBe(false);
  expect(useFplIndex).toHaveBeenCalledWith(false);
  for (const call of useTsdbPlayers.mock.calls) expect(call[1]).toBe(false);
});

test('no bio at all (the page still loading) → no dossier, nothing armed', () => {
  const { result } = renderHook(() => useDossier(null, comp, 'Celtic'));
  expect(result.current).toEqual({ bio: null, face: null, credit: null });
  for (const call of useWikiSummary.mock.calls) expect(call[1]).toBe(false);
  expect(useFplIndex).toHaveBeenCalledWith(false);
});
