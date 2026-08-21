import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import NextUpRow from './NextUpRow.jsx';

const club = { id: '256', name: 'Celtic', crestUrl: null, monogram: 'CE' };
const fixture = (over = {}) => ({
  id: 'e9', compId: 'uefa.champions', kickoff: '2026-08-26T19:00:00Z', status: 'scheduled',
  round: 'playoff-round', tv: null,
  home: { teamId: '256', name: 'Celtic' }, away: { teamId: '4411', name: 'LASK Linz' },
  ...over,
});

// Spec §13.29 follow-up: the leg reads on Next up too — the row that tells
// you what's coming must say it's half of something.
test('a leg fixture names its leg in the next-up context line', () => {
  render(<MemoryRouter>
    <NextUpRow club={club} fixture={fixture({ leg: 2 })} />
  </MemoryRouter>);
  expect(screen.getByText(/Champions League · 2nd leg ·/)).toBeInTheDocument();
});

test('an ordinary fixture keeps the context line leg-free', () => {
  render(<MemoryRouter>
    <NextUpRow club={club} fixture={fixture({ compId: 'sco.1', leg: null })} />
  </MemoryRouter>);
  expect(screen.queryByText(/leg/)).not.toBeInTheDocument();
});

// --- stale-snapshot heal (spec §13.32 follow-up): follow() froze the club
// object into persisted prefs, so a club followed BEFORE its crest existed
// wore the monogram in Next up forever while every fixture-fed surface
// updated. The fixture in the row IS that club's fixture — its side
// carries the fresh crest.
test('a followed club with no snapshot crest borrows the fixture side\'s fresh one', () => {
  const staleClub = { id: '147611871', name: 'Bellshill Athletic', crestUrl: null, monogram: 'BA' };
  render(<MemoryRouter>
    <NextUpRow club={staleClub} fixture={fixture({
      compId: 'wosfl.first',
      home: { teamId: '147611871', name: 'Bellshill Athletic',
        crestUrl: '/crests/wosfl/147611871.png' },
      away: { teamId: '168281523', name: 'Neilston' },
    })} />
  </MemoryRouter>);
  expect(document.querySelector('img[src="/crests/wosfl/147611871.png"]')).toBeTruthy();
});

test('a snapshot that HAS a crest keeps it — the heal only fills gaps', () => {
  const club = { id: '256', name: 'Celtic', crestUrl: 'https://a.espncdn.com/celtic.png', monogram: 'CE' };
  render(<MemoryRouter>
    <NextUpRow club={club} fixture={fixture({
      home: { teamId: '256', name: 'Celtic', crestUrl: 'https://something-else.png' },
      away: { teamId: '4411', name: 'LASK' },
    })} />
  </MemoryRouter>);
  expect(document.querySelector('img[src="https://a.espncdn.com/celtic.png"]')).toBeTruthy();
});
