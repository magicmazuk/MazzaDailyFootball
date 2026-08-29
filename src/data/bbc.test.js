import { adaptBbcFixtures, bbcRoundSlug } from './bbc.js';

const bbc = {
  eventGroups: [{
    displayLabel: 'Saturday 1st August',
    secondaryGroups: [
      {
        displayLabel: '2nd Round',
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
        ],
      },
      {
        // No displayLabel — e.g. a plain league fixture list — so its
        // events carry no round.
        events: [
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
      },
    ],
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

test('round is threaded down from each secondaryGroup displayLabel, null where absent', () => {
  const fx = adaptBbcFixtures(bbc, 'x');
  expect(fx[0].round).toBe('round-2'); // s-1, from the '2nd Round' group
  expect(fx[1].round).toBe('round-2'); // s-2, same group
  expect(fx[2].round).toBeNull(); // s-3, group has no displayLabel
  expect(fx[3].round).toBeNull(); // s-4, same group
});

test.each([
  ['1st Round', 'round-1'],
  ['2nd Round', 'round-2'],
  ['23rd Round', 'round-23'],
  ['Quarter-Finals', 'quarterfinals'],
  ['Quarterfinal', 'quarterfinals'],
  ['Semi-Finals', 'semifinals'],
  ['Semifinal', 'semifinals'],
  ['Final', 'final'],
  ['final', 'final'],
  ['Group A', 'group-stage'],
  ['group z', 'group-stage'], // case-insensitive
  ['Group AB', null], // not a single letter — not a group label
  ['Saturday 1st August', null], // an eventGroup label, not a round label
  [null, null],
  [undefined, null],
  ['', null],
])('bbcRoundSlug(%j) -> %j', (label, expected) => {
  expect(bbcRoundSlug(label)).toBe(expected);
});

test('adaptBbcFixtures propagates group labels through to round: "group-stage", the same slug ESPN uses', () => {
  const groupPayload = {
    eventGroups: [{
      displayLabel: 'Saturday 1st August',
      secondaryGroups: [{
        displayLabel: 'Group A',
        events: [{
          id: 'g-1', startDateTime: '2026-08-01T14:00:00Z', status: 'PreEvent',
          periodLabel: null, statusComment: null,
          home: { id: 'h1', fullName: 'Alloa Athletic' },
          away: { id: 'a1', fullName: 'East Fife' },
        }],
      }],
    }],
  };
  const fx = adaptBbcFixtures(groupPayload, 'sco.cis');
  expect(fx[0].round).toBe('group-stage');
});

// --- the lower-league goal wire (spec §13.44 second addendum): BBC's own
// actions carry scorer, minute and type — live-probed 2026-08-30 ---

test('adaptBbcFixtures: goal actions become fixture.goals in the wire shape', () => {
  const json = { eventGroups: [{ secondaryGroups: [{ displayLabel: null, events: [{
    id: 'b1', startDateTime: '2026-08-29T14:00:00Z', status: 'MatchStatusLive',
    periodLabel: { value: "90'" },
    home: { fullName: 'Elgin City', id: 'ec', scores: { fulltime: '4' },
      actions: [
        { playerName: 'W. Gibson', actionType: 'goal', actions: [
          { type: 'Penalty', timeLabel: { value: "57'" } },
        ] },
        { playerName: 'K. Watson', actionType: 'goal', actions: [
          { type: 'Goal', timeLabel: { value: "12'" } },
          { type: 'Goal', timeLabel: { value: "90'+2'" } },
        ] },
      ] },
    away: { fullName: 'Stirling Albion', id: 'sa', scores: { fulltime: '0' },
      actions: [
        { playerName: 'A. Body', actionType: 'booking', actions: [
          { type: 'Yellow Card', timeLabel: { value: "30'" } },
        ] },
      ] },
  }] }] }] };
  const [fx] = adaptBbcFixtures(json, 'scottish-league-two');
  expect(fx.goals).toEqual([
    { minute: "57'", clockValue: 57 * 60, scorer: 'W. Gibson', teamId: fx.home.teamId, ownGoal: false, penalty: true },
    { minute: "12'", clockValue: 12 * 60, scorer: 'K. Watson', teamId: fx.home.teamId, ownGoal: false, penalty: false },
    { minute: "90'+2'", clockValue: (90 + 2) * 60, scorer: 'K. Watson', teamId: fx.home.teamId, ownGoal: false, penalty: false },
  ]);
});

test('adaptBbcFixtures: an own goal is flagged and credited as the feed gives it; no actions means []', () => {
  const json = { eventGroups: [{ secondaryGroups: [{ displayLabel: null, events: [{
    id: 'b2', startDateTime: '2026-08-29T14:00:00Z', status: 'MatchStatusLive',
    home: { fullName: 'A', id: 'a', actions: [
      { playerName: 'O. Goal', actionType: 'goal', actions: [
        { type: 'Own Goal', timeLabel: { value: "5'" } },
      ] },
    ] },
    away: { fullName: 'B', id: 'b' },
  }] }] }] };
  const [fx] = adaptBbcFixtures(json, 'scottish-league-two');
  expect(fx.goals[0].ownGoal).toBe(true);
  expect(fx.goals[0].penalty).toBe(false);
  const bare = { eventGroups: [{ secondaryGroups: [{ displayLabel: null, events: [{
    id: 'b3', startDateTime: '2026-08-29T14:00:00Z', status: 'MatchStatusLive',
    home: { fullName: 'A', id: 'a' }, away: { fullName: 'B', id: 'b' },
  }] }] }] };
  expect(adaptBbcFixtures(bare, 'scottish-league-two')[0].goals).toEqual([]);
});
