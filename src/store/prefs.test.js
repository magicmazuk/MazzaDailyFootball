import { beforeEach, expect, test } from 'vitest';
import { usePrefs, CELTIC } from './prefs.js';

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({
    followed: { [CELTIC.id]: CELTIC }, hiddenComps: [],
    seenTies: {}, seenSeeded: false, seededComps: {},
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

// --- seedCompIfNeeded (per-competition seeding, spec §13.14) ---
// Replaces the old global seedSeenIfEmpty/seenSeeded latch after two live
// defects (first-run flash while a sibling comp was still pending; a
// failed comp could never seed even after later recovering) — see
// prefs.js's doc comment for the full rationale.

test('seedCompIfNeeded seeds all given ids and latches only that comp', () => {
  usePrefs.getState().seedCompIfNeeded('sco.tennents', ['sco.tennents:1', 'sco.tennents:2']);
  expect(usePrefs.getState().seenTies).toEqual({
    'sco.tennents:1': true, 'sco.tennents:2': true,
  });
  expect(usePrefs.getState().seededComps).toEqual({ 'sco.tennents': true });
});

test('seedCompIfNeeded is a no-op for a comp already latched, even with different ids', () => {
  usePrefs.getState().seedCompIfNeeded('sco.tennents', ['sco.tennents:1']);
  usePrefs.getState().seedCompIfNeeded('sco.tennents', ['sco.tennents:2']);
  expect(usePrefs.getState().seenTies).toEqual({ 'sco.tennents:1': true });
});

test('seedCompIfNeeded([]) is a no-op that does NOT latch that comp — a later non-empty call still seeds it', () => {
  // Same load-race contract as the old function: a caller invoked before
  // its fixtures query has resolved must not permanently swallow seeding
  // for that comp by latching on an empty catalogue.
  usePrefs.getState().seedCompIfNeeded('sco.tennents', []);
  expect(usePrefs.getState().seededComps['sco.tennents']).toBeUndefined();
  expect(usePrefs.getState().seenTies).toEqual({});
  usePrefs.getState().seedCompIfNeeded('sco.tennents', ['sco.tennents:1']);
  expect(usePrefs.getState().seenTies).toEqual({ 'sco.tennents:1': true });
  expect(usePrefs.getState().seededComps['sco.tennents']).toBe(true);
});

test('a second comp seeds independently, unaffected by another comp already being latched', () => {
  usePrefs.getState().seedCompIfNeeded('sco.tennents', ['sco.tennents:1']);
  usePrefs.getState().seedCompIfNeeded('eng.fa', ['eng.fa:9']);
  expect(usePrefs.getState().seenTies).toEqual({ 'sco.tennents:1': true, 'eng.fa:9': true });
  expect(usePrefs.getState().seededComps).toEqual({ 'sco.tennents': true, 'eng.fa': true });
});

test('a legacy install (old global seenSeeded latch) latches the comp WITHOUT re-seeding — its old seenTies already covers it', () => {
  usePrefs.setState({ seenSeeded: true, seenTies: { 'sco.tennents:1': true } });
  usePrefs.getState().seedCompIfNeeded('sco.tennents', ['sco.tennents:1', 'sco.tennents:2']);
  // sco.tennents:2 must NOT be silently added — the legacy blob is trusted
  // as-is; only the per-comp latch catches up.
  expect(usePrefs.getState().seenTies).toEqual({ 'sco.tennents:1': true });
  expect(usePrefs.getState().seededComps).toEqual({ 'sco.tennents': true });
});

test('markTiesSeen after per-comp seeding adds additively', () => {
  usePrefs.getState().seedCompIfNeeded('sco.tennents', ['sco.tennents:1']);
  usePrefs.getState().markTiesSeen(['sco.tennents:2', 'sco.tennents:3']);
  expect(usePrefs.getState().seenTies).toEqual({
    'sco.tennents:1': true, 'sco.tennents:2': true, 'sco.tennents:3': true,
  });
});
