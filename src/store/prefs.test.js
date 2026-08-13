import { beforeEach, expect, test } from 'vitest';
import { usePrefs, CELTIC } from './prefs.js';

beforeEach(() => {
  localStorage.clear();
  usePrefs.setState({ followed: { [CELTIC.id]: CELTIC }, hiddenComps: [] });
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
