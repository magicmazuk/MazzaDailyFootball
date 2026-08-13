import {
  adaptScoreboard, adaptStandings, adaptTeams, adaptSquad, adaptSummary,
} from './espn.js';

const scoreboard = {
  events: [
    {
      id: '401878415',
      date: '2026-08-01T14:00Z',
      name: 'St Mirren at Falkirk', // "Away at Home" — never parse this
      season: { slug: 'regular-season' },
      status: { type: { name: 'STATUS_FULL_TIME', state: 'post', completed: true } },
      competitions: [{
        venue: { fullName: 'Falkirk Stadium' },
        competitors: [
          { homeAway: 'home', score: '1',
            team: { id: '254', displayName: 'Falkirk', abbreviation: 'FALK',
                    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/254.png', color: '000099' } },
          { homeAway: 'away', score: '0',
            team: { id: '250', displayName: 'St Mirren', abbreviation: 'STM',
                    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/250.png', color: '000000' } },
        ],
      }],
    },
    {
      id: '2', date: '2026-08-22T14:00Z', name: 'B at A',
      season: { slug: 'fourth-round' },
      status: { type: { name: 'STATUS_FIRST_HALF', state: 'in', completed: false }, displayClock: "37'" },
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '2', team: { id: '10603', displayName: 'Auchinleck Talbot' } },
          { homeAway: 'away', score: '0', team: { id: '256', displayName: 'Celtic', logo: 'x.png' } },
        ],
      }],
    },
    {
      id: '3', date: '2026-08-22T14:00Z', name: 'D at C',
      status: { type: { name: 'STATUS_POSTPONED', state: 'pre', completed: false } },
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '0', team: { id: '256', displayName: 'Celtic' } },
          { homeAway: 'away', score: '0', team: { id: '267', displayName: 'St Johnstone' } },
        ],
      }],
    },
  ],
};

test('scoreboard: home/away from homeAway, never from event.name', () => {
  const [ft] = adaptScoreboard(scoreboard, 'sco.1');
  expect(ft.home.name).toBe('Falkirk');
  expect(ft.away.name).toBe('St Mirren');
  expect(ft.home.score).toBe(1);
  expect(ft.away.score).toBe(0);
  expect(ft.status).toBe('ft');
  expect(ft.round).toBe('regular-season');
  expect(ft.venue).toBe('Falkirk Stadium');
  expect(ft.compId).toBe('sco.1');
});

test('scoreboard: in-play maps to live with a minute; crestless side gets a monogram', () => {
  const live = adaptScoreboard(scoreboard, 'sco.tennents')[1];
  expect(live.status).toBe('live');
  expect(live.minute).toBe("37'");
  expect(live.home.crestUrl).toBeNull();
  expect(live.home.monogram).toBe('AT');
  expect(live.away.crestUrl).toBe('x.png');
});

test('scoreboard: postponed maps to postponed, not scheduled', () => {
  expect(adaptScoreboard(scoreboard, 'sco.1')[2].status).toBe('postponed');
});

const standings = {
  children: [{
    standings: {
      entries: [
        { team: { id: '262', displayName: 'Heart of Midlothian',
                  logos: [{ href: 'hearts.png' }] },
          stats: [
            { name: 'gamesPlayed', value: 38 }, { name: 'wins', value: 24 },
            { name: 'ties', value: 8 }, { name: 'losses', value: 6 },
            { name: 'pointsFor', value: 67 }, { name: 'pointsAgainst', value: 34 },
            { name: 'pointDifferential', value: 33 }, { name: 'points', value: 80 },
            { name: 'deductions', value: 0 }, { name: 'rank', value: 2 },
          ] },
        { team: { id: '256', displayName: 'Celtic', logos: [{ href: 'celtic.png' }] },
          stats: [
            { name: 'gamesPlayed', value: 38 }, { name: 'wins', value: 26 },
            { name: 'ties', value: 4 }, { name: 'losses', value: 8 },
            { name: 'pointsFor', value: 73 }, { name: 'pointsAgainst', value: 41 },
            { name: 'pointDifferential', value: 32 }, { name: 'points', value: 82 },
            { name: 'deductions', value: -5 }, { name: 'rank', value: 1 },
          ] },
      ],
    },
  }],
};

test('standings: rows sorted by rank, renumbered, deductions preserved', () => {
  const rows = adaptStandings(standings);
  expect(rows.map(r => r.name)).toEqual(['Celtic', 'Heart of Midlothian']);
  expect(rows[0].position).toBe(1);
  expect(rows[0].points).toBe(82);
  expect(rows[0].deduction).toBe(-5);
  expect(rows[1].goalDifference).toBe(33);
  expect(rows[1].crestUrl).toBe('hearts.png');
});

const teams = {
  sports: [{ leagues: [{ teams: [
    { team: { id: '263', displayName: 'Aberdeen', shortDisplayName: 'Aberdeen',
              color: 'C8142F', logos: [{ href: 'abz.png' }] } },
  ] }] }],
};

test('teams: id, colour and crest come through', () => {
  const [t] = adaptTeams(teams);
  expect(t).toEqual({ id: '263', name: 'Aberdeen', shortName: 'Aberdeen',
    crestUrl: 'abz.png', monogram: 'AB', colour: 'C8142F' });
});

const squad = {
  team: { id: '256', athletes: [
    { id: '227283', displayName: 'Ross Doohan',
      position: { abbreviation: 'G' }, jersey: '1', age: 28, citizenship: 'Scotland' },
    { id: '9', displayName: 'No Details' },
  ] },
};

test('squad: players map with null-safe optional fields', () => {
  const players = adaptSquad(squad);
  expect(players[0]).toEqual({ id: '227283', name: 'Ross Doohan', position: 'G',
    shirt: '1', age: 28, nationality: 'Scotland' });
  expect(players[1].position).toBeNull();
  expect(players[1].shirt).toBeNull();
});

const summary = {
  keyEvents: [
    { clock: { displayValue: "11'" }, type: { text: 'Goal' },
      athletesInvolved: [{ displayName: 'Daizen Maeda' }], team: { id: '256' } },
    { clock: { displayValue: "59'" }, type: { text: 'Substitution' } }, // no athletes — real case
  ],
  boxscore: { teams: [
    { team: { id: '256', displayName: 'Celtic' },
      statistics: [{ name: 'possessionPct', displayValue: '58' }] },
    { team: { id: '257', displayName: 'Rangers' },
      statistics: [{ name: 'possessionPct', displayValue: '42' }] },
  ] },
  rosters: [
    { homeAway: 'home', roster: [
      { athlete: { displayName: 'Kasper Schmeichel' }, jersey: '1', starter: true,
        position: { abbreviation: 'G' } },
    ] },
  ],
};

test('summary: events null-safe, team stats keyed by name, lineups mapped', () => {
  const d = adaptSummary(summary);
  expect(d.events[0]).toEqual({ minute: "11'", type: 'Goal', player: 'Daizen Maeda', teamId: '256' });
  expect(d.events[1].player).toBeNull();
  expect(d.teamStats[0].stats.possessionPct).toBe('58');
  expect(d.lineups[0].players[0]).toEqual({ name: 'Kasper Schmeichel', shirt: '1',
    starter: true, position: 'G' });
});

test('summary: missing boxscore yields null teamStats, not a crash', () => {
  expect(adaptSummary({}).teamStats).toBeNull();
  expect(adaptSummary({}).events).toEqual([]);
});
