import { beforeEach, expect, test } from 'vitest';
import { usePrefs, CELTIC } from './prefs.js';

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({
    followed: { [CELTIC.id]: CELTIC }, hiddenComps: [],
    seenTies: {}, seenSeeded: false,
  });
});

test('Celtic is followed out of the box', () => {
  expect(usePrefs.getState().followed['256'].name).toBe('Celtic');
});

test('follow adds a club and persists it', () => {
  usePrefs.getState().follow({ id: '254', name: 'Falkirk', crestUrl: 'f.png',
    monogram: 'FA', colour: '000099' });
  expect(usePrefs.getState().followed['254'].name).toBe('Falkirk');
  expect(localStorage.getItem('mdf-prefs')).toContain('Falkirk');
});

test('unfollow removes a club', () => {
  usePrefs.getState().follow({ id: '254', name: 'Falkirk', crestUrl: null,
    monogram: 'FA', colour: null });
  usePrefs.getState().unfollow('254');
  expect(usePrefs.getState().followed['254']).toBeUndefined();
});

test('Celtic cannot be unfollowed', () => {
  usePrefs.getState().unfollow('256');
  expect(usePrefs.getState().followed['256']).toBeDefined();
});

test('toggleComp hides and reveals a competition', () => {
  usePrefs.getState().toggleComp('eng.fa');
  expect(usePrefs.getState().hiddenComps).toEqual(['eng.fa']);
  usePrefs.getState().toggleComp('eng.fa');
  expect(usePrefs.getState().hiddenComps).toEqual([]);
});

test('adding seenTies to the store shape does not break existing persisted keys (additive persist merge)', () => {
  localStorage.setItem('mdf-prefs', JSON.stringify({
    state: {
      followed: { [CELTIC.id]: CELTIC, 254: { id: '254', name: 'Falkirk' } },
      hiddenComps: ['eng.fa'],
    },
    version: 0,
  }));
  usePrefs.persist.rehydrate();
  const state = usePrefs.getState();
  expect(state.followed['254'].name).toBe('Falkirk');
  expect(state.hiddenComps).toEqual(['eng.fa']);
  expect(state.seenTies).toEqual({});
});

test('seedSeenIfEmpty seeds all given ids the first time', () => {
  usePrefs.getState().seedSeenIfEmpty(['sco.tennents:1', 'sco.tennents:2']);
  expect(usePrefs.getState().seenTies).toEqual({
    'sco.tennents:1': true, 'sco.tennents:2': true,
  });
});

test('seedSeenIfEmpty is a no-op on a second call, even with different ids', () => {
  usePrefs.getState().seedSeenIfEmpty(['sco.tennents:1']);
  usePrefs.getState().seedSeenIfEmpty(['sco.tennents:2']);
  expect(usePrefs.getState().seenTies).toEqual({ 'sco.tennents:1': true });
});

test('seedSeenIfEmpty does not re-seed once seenSeeded is already true, even with a non-empty catalogue', () => {
  usePrefs.setState({ seenTies: {}, seenSeeded: true });
  usePrefs.getState().seedSeenIfEmpty(['sco.tennents:1']);
  expect(usePrefs.getState().seenTies).toEqual({});
});

test('seedSeenIfEmpty([]) is a no-op that does NOT latch — a later non-empty call still seeds', () => {
  // Guards against a load race: a caller invoked before its fixtures query
  // has resolved must not permanently swallow seeding by latching on an
  // empty catalogue. Callers are contractually required to call only once
  // their query has settled; an empty call is treated as "not loaded yet",
  // not as "zero ties exist".
  usePrefs.getState().seedSeenIfEmpty([]);
  expect(usePrefs.getState().seenSeeded).toBe(false);
  expect(usePrefs.getState().seenTies).toEqual({});
  usePrefs.getState().seedSeenIfEmpty(['sco.tennents:1']);
  expect(usePrefs.getState().seenTies).toEqual({ 'sco.tennents:1': true });
  expect(usePrefs.getState().seenSeeded).toBe(true);
});

test('markTiesSeen after seeding adds additively', () => {
  usePrefs.getState().seedSeenIfEmpty(['sco.tennents:1']);
  usePrefs.getState().markTiesSeen(['sco.tennents:2', 'sco.tennents:3']);
  expect(usePrefs.getState().seenTies).toEqual({
    'sco.tennents:1': true, 'sco.tennents:2': true, 'sco.tennents:3': true,
  });
});
