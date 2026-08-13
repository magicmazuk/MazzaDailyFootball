import { adaptBbcFixtures } from './bbc.js';

const bbc = {
  eventGroups: [{
    displayLabel: 'Saturday 1st August',
    secondaryGroups: [{
      events: [
        {
          id: 's-1', startDateTime: '2026-08-01T14:00:00Z', status: 'PostEvent',
          periodLabel: { value: 'FT' }, statusComment: { accessible: 'Full time' },
          home: { id: 'h1', fullName: 'Alloa Athletic', shortName: 'Alloa', score: '0' },
          away: { id: 'a1', fullName: 'East Fife', shortName: 'East Fife', score: '0' },
        },
        {
          id: 's-2', startDateTime: '2026-08-25T18:45:00Z', status: 'PreEvent',
          periodLabel: null, statusComment: null,
          home: { id: 'h2', fullName: 'Cove Rangers', shortName: 'Cove' },
          away: { id: 'a2', fullName: 'Kelty Hearts', shortName: 'Kelty' },
        },
        {
          id: 's-3', startDateTime: '2026-08-25T18:45:00Z', status: 'MidEvent',
          periodLabel: { value: "63'" }, statusComment: { accessible: 'In play' },
          home: { id: 'h3', fullName: 'Queen of the South', score: '1' },
          away: { id: 'a3', fullName: 'Montrose', score: '1' },
        },
        {
          id: 's-4', startDateTime: '2026-09-01T18:45:00Z', status: 'PreEvent',
          periodLabel: null, statusComment: { accessible: 'Postponed' },
          home: { id: 'h4', fullName: 'Dumbarton' },
          away: { id: 'a4', fullName: 'Peterhead' },
        },
      ],
    }],
  }],
};

test('flattens the nested groups and maps the domain shape', () => {
  const fx = adaptBbcFixtures(bbc, 'scottish-league-one');
  expect(fx).toHaveLength(4);
  expect(fx[0].compId).toBe('scottish-league-one');
  expect(fx[0].status).toBe('ft');
  expect(fx[0].home.name).toBe('Alloa Athletic');
  expect(fx[0].home.score).toBe(0);
  expect(fx[0].home.crestUrl).toBeNull();
  expect(fx[0].home.monogram).toBe('AA');
});

test('missing score is null, not zero — a 0-0 and an unplayed game differ', () => {
  expect(adaptBbcFixtures(bbc, 'x')[1].home.score).toBeNull();
  expect(adaptBbcFixtures(bbc, 'x')[1].status).toBe('scheduled');
});

test('MidEvent maps to live and carries the period label as minute', () => {
  const live = adaptBbcFixtures(bbc, 'x')[2];
  expect(live.status).toBe('live');
  expect(live.minute).toBe("63'");
});

test('statusComment Postponed wins over the raw status', () => {
  expect(adaptBbcFixtures(bbc, 'x')[3].status).toBe('postponed');
});

test('empty and malformed payloads yield an empty list', () => {
  expect(adaptBbcFixtures({}, 'x')).toEqual([]);
  expect(adaptBbcFixtures(null, 'x')).toEqual([]);
});
