import { expect, test } from 'vitest';
import { fplLadder, leagueLadder } from './fantasy.js';

// The trimmed /fpl/index shape (spec §13.40): points = total_points,
// event = event_points. Newcastle deliberately named the FPL way ('Newcastle')
// while the club context arrives the ESPN way ('Newcastle United').
const INDEX = {
  teams: [{ id: 1, name: 'Arsenal' }, { id: 2, name: 'Newcastle' }],
  players: [
    { code: 1, first: 'Bukayo', second: 'Saka', web: 'Saka', team: 1, points: 9, event: 4 },
    { code: 2, first: 'David', second: 'Raya', web: 'Raya', team: 1, points: 6, event: 2 },
    { code: 3, first: 'Martin', second: 'Ødegaard', web: 'Ødegaard', team: 1, points: 11, event: 5 },
    { code: 4, first: 'Anthony', second: 'Elanga', web: 'Elanga', team: 2, points: 12, event: 7 },
    { code: 5, first: 'Nick', second: 'Pope', web: 'Pope', team: 2, points: 3, event: 0 },
  ],
};

test('a club ladder ranks its own FPL squad by season points, descending', () => {
  expect(fplLadder(INDEX, 'Arsenal')).toEqual([
    { name: 'Ødegaard', points: 11, event: 5 },
    { name: 'Saka', points: 9, event: 4 },
    { name: 'Raya', points: 6, event: 2 },
  ]);
});

test('the club matches the dossier way — ESPN name to FPL name, containment, uniquely', () => {
  const ladder = fplLadder(INDEX, 'Newcastle United');
  expect(ladder.map(r => r.name)).toEqual(['Elanga', 'Pope']);
});

test('n caps the ladder', () => {
  expect(fplLadder(INDEX, 'Arsenal', 2).map(r => r.name)).toEqual(['Ødegaard', 'Saka']);
});

test('an unmatched club, or an index without points fields, renders nothing — never zeros', () => {
  expect(fplLadder(INDEX, 'Celtic')).toBeNull();
  expect(fplLadder(null, 'Arsenal')).toBeNull();
  const prePoints = { teams: INDEX.teams,
    players: [{ code: 1, web: 'Saka', team: 1 }] };
  expect(fplLadder(prePoints, 'Arsenal')).toBeNull();
});

test('the league ladder is the whole division top-n, each row wearing its club', () => {
  expect(leagueLadder(INDEX, 3)).toEqual([
    { name: 'Elanga', club: 'Newcastle', points: 12, event: 7 },
    { name: 'Ødegaard', club: 'Arsenal', points: 11, event: 5 },
    { name: 'Saka', club: 'Arsenal', points: 9, event: 4 },
  ]);
});

test('the league ladder also refuses a pointless index', () => {
  expect(leagueLadder({ teams: [], players: [{ web: 'X', team: 1 }] })).toBeNull();
  expect(leagueLadder(null)).toBeNull();
});
