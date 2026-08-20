import {
  adaptScoreboard, adaptStandings, adaptTeams, adaptSquad, adaptSummary, adaptTeamRecord,
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

const shootout = {
  events: [
    {
      id: '4', date: '2026-08-22T14:00Z', name: 'F at E',
      status: { type: { name: 'STATUS_FINAL_PEN', state: 'post', completed: true } },
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '1', shootoutScore: '4',
            team: { id: '256', displayName: 'Celtic' } },
          { homeAway: 'away', score: '1', shootoutScore: '3',
            team: { id: '257', displayName: 'Rangers' } },
        ],
      }],
    },
    {
      id: '5', date: '2026-08-22T14:00Z', name: 'H at G',
      status: { type: { name: 'STATUS_FINAL_AET', state: 'post', completed: true } },
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '2', team: { id: '256', displayName: 'Celtic' } },
          { homeAway: 'away', score: '1', team: { id: '257', displayName: 'Rangers' } },
        ],
      }],
    },
  ],
};

test('scoreboard: a penalty shootout carries penaltyScore and status STATUS_FINAL_PEN maps to ft', () => {
  const [pens] = adaptScoreboard(shootout, 'eng.fa');
  expect(pens.status).toBe('ft');
  expect(pens.home.penaltyScore).toBe(4);
  expect(pens.away.penaltyScore).toBe(3);
});

test('scoreboard: extra time without a shootout leaves penaltyScore null; STATUS_FINAL_AET maps to ft', () => {
  const [, aet] = adaptScoreboard(shootout, 'eng.fa');
  expect(aet.status).toBe('ft');
  expect(aet.home.penaltyScore).toBeNull();
  expect(aet.away.penaltyScore).toBeNull();
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
            { name: 'rankChange', value: -1 },
          ] },
        { team: { id: '256', displayName: 'Celtic', logos: [{ href: 'celtic.png' }] },
          stats: [
            { name: 'gamesPlayed', value: 38 }, { name: 'wins', value: 26 },
            { name: 'ties', value: 4 }, { name: 'losses', value: 8 },
            { name: 'pointsFor', value: 73 }, { name: 'pointsAgainst', value: 41 },
            { name: 'pointDifferential', value: 32 }, { name: 'points', value: 82 },
            { name: 'deductions', value: -5 }, { name: 'rank', value: 1 },
            { name: 'rankChange', value: 2 },
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
  expect(rows[0].rankChange).toBe(2);
  expect(rows[1].goalDifference).toBe(33);
  expect(rows[1].crestUrl).toBe('hearts.png');
  expect(rows[1].rankChange).toBe(-1);
});

test('standings: rankChange defaults to 0 when the stat is absent', () => {
  const noRankChange = {
    standings: { entries: [
      { team: { id: '1', displayName: 'No Movement FC' },
        stats: [{ name: 'rank', value: 1 }] },
    ] },
  };
  expect(adaptStandings(noRankChange)[0].rankChange).toBe(0);
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

test('teams: null-safe with missing team key and missing logos/color', () => {
  const teamsWithMissing = {
    sports: [{ leagues: [{ teams: [
      { team: null },
      { },
      { team: { id: '999', displayName: 'Minimal Team' } },
    ] }] }],
  };
  const results = adaptTeams(teamsWithMissing);
  expect(results[0]).toEqual({ id: null, name: 'Unknown', shortName: 'Unknown',
    crestUrl: null, monogram: 'UN', colour: null });
  expect(results[1]).toEqual({ id: null, name: 'Unknown', shortName: 'Unknown',
    crestUrl: null, monogram: 'UN', colour: null });
  expect(results[2]).toEqual({ id: '999', name: 'Minimal Team', shortName: 'Minimal Team',
    crestUrl: null, monogram: 'MT', colour: null });
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

// --- adaptTeamRecord (the scout, spec §13.20): a foreign club's record —
// derived from the 'total' record item's NAMED stats array, never the
// undocumented `summary` string ('3-0-0'), whose field order isn't
// guaranteed. Live-verified shape (aut.1/teams/4411?enable=roster): named
// gamesPlayed/losses/points/pointsAgainst/pointDifferential, but wins/ties
// are not always present by name. ---

const recordFull = { team: { record: { items: [
  { type: 'total', summary: '3-0-0', stats: [
    { name: 'gamesPlayed', value: 3 }, { name: 'wins', value: 3 }, { name: 'ties', value: 0 },
    { name: 'losses', value: 0 }, { name: 'points', value: 9 },
  ] },
] } } };

test('team record: full named stats map directly, summary string untouched', () => {
  expect(adaptTeamRecord(recordFull)).toEqual({ played: 3, wins: 3, draws: 0, losses: 0, points: 9 });
});

const recordMissingWinsTies = { team: { record: { items: [
  {
    type: 'total',
    summary: '3-0-0', // deliberately NOT parsed — its field order is undocumented
    stats: [
      { name: 'gamesPlayed', value: 3 }, { name: 'losses', value: 0 },
      { name: 'points', value: 9 }, { name: 'pointsAgainst', value: 1 },
      { name: 'pointDifferential', value: 8 },
    ],
  },
] } } };

test('team record: missing wins/ties by name reconciles exactly from points/losses/played arithmetic', () => {
  expect(adaptTeamRecord(recordMissingWinsTies)).toEqual({ played: 3, wins: 3, draws: 0, losses: 0, points: 9 });
});

const recordIrreconcilable = { team: { record: { items: [
  { type: 'total', summary: '3-0-0', stats: [
    { name: 'gamesPlayed', value: 3 }, { name: 'losses', value: 0 }, { name: 'points', value: 10 },
  ] },
] } } };

test('team record: irreconcilable arithmetic (no non-negative integer solution) yields nulls for the underivable fields, never a guess', () => {
  expect(adaptTeamRecord(recordIrreconcilable)).toEqual({ played: 3, wins: null, draws: null, losses: 0, points: 10 });
});

test('team record: no total item, no items array, or no record at all is null', () => {
  expect(adaptTeamRecord({ team: { record: { items: [{ type: 'home', stats: [] }] } } })).toBeNull();
  expect(adaptTeamRecord({ team: { record: { items: [] } } })).toBeNull();
  expect(adaptTeamRecord({ team: {} })).toBeNull();
  expect(adaptTeamRecord({})).toBeNull();
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
      { athlete: { id: '227283', displayName: 'Kasper Schmeichel' }, jersey: '1', starter: true,
        position: { abbreviation: 'G' } },
    ] },
  ],
};

test('summary: events null-safe, team stats keyed by name, lineups mapped', () => {
  const d = adaptSummary(summary);
  expect(d.events[0]).toEqual({ minute: "11'", type: 'Goal', player: 'Daizen Maeda',
    playerId: null, playerOff: null, playerOffId: null, teamId: '256', scoringPlay: false });
  expect(d.events[1].player).toBeNull();
  expect(d.teamStats[0].stats.possessionPct).toBe('58');
  expect(d.lineups[0].players[0]).toEqual({ id: '227283', name: 'Kasper Schmeichel', shirt: '1',
    starter: true, position: 'G' });
});

test('summary: missing boxscore yields null teamStats, not a crash', () => {
  expect(adaptSummary({}).teamStats).toBeNull();
  expect(adaptSummary({}).events).toEqual([]);
});

test('summary: adaptSummary({}) is fully null-safe for every enrichment field', () => {
  const d = adaptSummary({});
  expect(d.teamStats).toBeNull();
  expect(d.events).toEqual([]);
  expect(d.lineups).toEqual([]);
  expect(d.liveScore).toBeNull();
  expect(d.gameInfo).toBeNull();
  expect(d.form).toBeNull();
  expect(d.headToHead).toBeNull();
  expect(d.standouts).toBeNull();
});

// --- keyEvents: participants (current ESPN shape) vs athletesInvolved (legacy) ---

test('summary: goal event reads player from participants and carries scoringPlay', () => {
  const goalViaParticipants = {
    keyEvents: [
      { type: { text: 'Goal' }, text: "Kasper Høgh (Celtic) Goal at 2'",
        clock: { displayValue: "2'" }, scoringPlay: true,
        team: { id: '256', displayName: 'Celtic' },
        participants: [{ athlete: { id: '272624', displayName: 'Kasper Høgh' } }] },
    ],
  };
  const d = adaptSummary(goalViaParticipants);
  expect(d.events[0]).toEqual({
    minute: "2'", type: 'Goal', player: 'Kasper Høgh', playerId: '272624',
    playerOff: null, playerOffId: null, teamId: '256', scoringPlay: true,
  });
});

test('summary: substitution maps player coming on and player going off from the two participants', () => {
  const substitution = {
    keyEvents: [
      { type: { text: 'Substitution' }, clock: { displayValue: "45'" },
        team: { id: '256' },
        participants: [
          { athlete: { id: '387200', displayName: 'Colby Donovan' } },
          { athlete: { id: '293691', displayName: 'Alistair Johnston' } },
        ] },
    ],
  };
  const d = adaptSummary(substitution);
  expect(d.events[0].player).toBe('Colby Donovan');
  expect(d.events[0].playerId).toBe('387200');
  expect(d.events[0].playerOff).toBe('Alistair Johnston');
  expect(d.events[0].playerOffId).toBe('293691');
  expect(d.events[0].scoringPlay).toBe(false);
});

test('summary: legacy payload with only athletesInvolved still yields a player (backward compat)', () => {
  const legacy = {
    keyEvents: [
      { clock: { displayValue: "11'" }, type: { text: 'Goal' },
        athletesInvolved: [{ displayName: 'Daizen Maeda' }], team: { id: '256' } },
    ],
  };
  const d = adaptSummary(legacy);
  expect(d.events[0].player).toBe('Daizen Maeda');
  expect(d.events[0].playerId).toBeNull(); // athletesInvolved carries no id, only participants does
  expect(d.events[0].playerOff).toBeNull();
  expect(d.events[0].playerOffId).toBeNull();
  expect(d.events[0].scoringPlay).toBe(false);
});

// --- gameInfo ---

test('summary: gameInfo maps attendance, referee pick and venue with city', () => {
  const withGameInfo = {
    gameInfo: {
      venue: { fullName: 'The BBSP Stadium', address: { city: 'Kilmarnock', country: 'Scotland' } },
      attendance: 8353,
      officials: [{ displayName: 'Ryan Lee', position: { name: 'Referee', displayName: 'Referee' } }],
    },
  };
  expect(adaptSummary(withGameInfo).gameInfo).toEqual({
    attendance: 8353, referee: 'Ryan Lee', venue: 'The BBSP Stadium, Kilmarnock',
  });
});

test('summary: gameInfo referee falls back to the first official when none is a Referee', () => {
  const noRefereePosition = {
    gameInfo: { officials: [{ displayName: 'Assistant One', position: { displayName: 'Assistant Referee' } }] },
  };
  expect(adaptSummary(noRefereePosition).gameInfo.referee).toBe('Assistant One');
});

test('summary: gameInfo venue without a city falls back to venue name alone; missing gameInfo is null', () => {
  const noCity = { gameInfo: { venue: { fullName: 'Neutral Ground' } } };
  expect(adaptSummary(noCity).gameInfo).toEqual({ attendance: null, referee: null, venue: 'Neutral Ground' });
  expect(adaptSummary({}).gameInfo).toBeNull();
});

// --- form ---

test('summary: form is keyed by teamId, filtered to W/D/L and capped at 5', () => {
  const withForm = {
    lastFiveGames: [
      { team: { id: '260' }, events: [
        { gameResult: 'W' }, { gameResult: 'D' }, { gameResult: 'L' },
        { gameResult: 'W' }, { gameResult: 'W' }, { gameResult: 'L' },
      ] },
      { team: { id: '256' }, events: [{ gameResult: 'W' }] },
    ],
  };
  const d = adaptSummary(withForm);
  expect(d.form['260']).toEqual(['W', 'D', 'L', 'W', 'W']);
  expect(d.form['256']).toEqual(['W']);
});

test('summary: missing lastFiveGames yields null form', () => {
  expect(adaptSummary({}).form).toBeNull();
});

// --- headToHead ---

test('summary: headToHead maps completed meetings with scores and team names, skipping incomplete ones', () => {
  const withSeries = {
    seasonseries: [{
      summary: 'CEL leads series 5-0',
      events: [
        { date: '2026-02-15T14:00:00Z', statusType: { completed: true },
          competitors: [
            { homeAway: 'home', team: { displayName: 'Kilmarnock' }, score: '2' },
            { homeAway: 'away', team: { displayName: 'Celtic' }, score: '3' },
          ] },
        { date: '2026-09-01T14:00:00Z', statusType: { completed: false }, // not yet played
          competitors: [
            { homeAway: 'home', team: { displayName: 'Celtic' }, score: '' },
            { homeAway: 'away', team: { displayName: 'Kilmarnock' }, score: '' },
          ] },
      ],
    }],
  };
  const d = adaptSummary(withSeries);
  expect(d.headToHead.summary).toBe('CEL leads series 5-0');
  expect(d.headToHead.meetings).toEqual([
    { date: '2026-02-15T14:00:00Z', homeName: 'Kilmarnock', awayName: 'Celtic', homeScore: 2, awayScore: 3 },
  ]);
});

test('summary: missing seasonseries yields null headToHead', () => {
  expect(adaptSummary({}).headToHead).toBeNull();
});

// --- standouts ---

test('summary: standouts map shots/saves/passes leaders per team, skipping absent or empty categories', () => {
  const withLeaders = {
    leaders: [
      { team: { id: '260', displayName: 'Kilmarnock' }, leaders: [
        { name: 'totalShots', leaders: [{ displayValue: '3',
          athlete: { id: '351372', displayName: 'Joe Hugill' } }] },
        { name: 'accuratePasses', leaders: [{ displayValue: '42',
          athlete: { id: '173306', displayName: 'Aaron Tshibola' } }] },
        { name: 'saves', leaders: [] },
      ] },
      { team: { id: '256', displayName: 'Celtic' }, leaders: [
        { name: 'totalShots', leaders: [{ displayValue: '9', athlete: { id: '272624', displayName: 'Kasper Høgh' } }] },
      ] },
    ],
  };
  const d = adaptSummary(withLeaders);
  expect(d.standouts[0]).toEqual({
    teamId: '260', teamName: 'Kilmarnock',
    entries: [
      { label: 'Shots', player: 'Joe Hugill', playerId: '351372', value: '3' },
      { label: 'Passes', player: 'Aaron Tshibola', playerId: '173306', value: '42' },
    ],
  });
  expect(d.standouts[1].entries).toEqual([
    { label: 'Shots', player: 'Kasper Høgh', playerId: '272624', value: '9' },
  ]);
});

test('summary: missing leaders yields null standouts', () => {
  expect(adaptSummary({}).standouts).toBeNull();
});

test('summary: header competitors produce a fresher liveScore keyed by homeAway', () => {
  const withHeader = {
    ...summary,
    header: { competitions: [{ competitors: [
      { homeAway: 'home', team: { id: '256' }, score: '3' },
      { homeAway: 'away', team: { id: '257' }, score: '1' },
    ] }] },
  };
  const d = adaptSummary(withHeader);
  expect(d.liveScore).toEqual({
    home: { teamId: '256', score: 3 },
    away: { teamId: '257', score: 1 },
  });
});

test('summary: liveScore is null when the header is absent', () => {
  expect(adaptSummary(summary).liveScore).toBeNull();
  expect(adaptSummary({}).liveScore).toBeNull();
});

// --- two-legged ties (spec §13.29): leg, aggregate and the tie's verdict
// come straight off the scoreboard event — live-probed 2026-08-20 on the
// UEFA qualifier feeds (leg.value, series.completed + winner flags,
// competitors[].aggregateScore).
const tieScoreboard = {
  events: [{
    id: 'L2', date: '2026-08-12T18:45Z',
    season: { slug: 'third-qualifying-round' },
    status: { type: { name: 'STATUS_FULL_TIME', state: 'post', completed: true } },
    series: { completed: true, totalCompetitions: 2, competitors: [
      { id: '2528', winner: false }, { id: '490', winner: true },
    ] },
    competitions: [{
      leg: { value: 2, displayValue: '2nd Leg' },
      competitors: [
        { homeAway: 'home', score: '0', aggregateScore: 0.0,
          team: { id: '2528', displayName: 'Kairat Almaty' } },
        { homeAway: 'away', score: '1', aggregateScore: 2.0,
          team: { id: '490', displayName: 'Levski Sofia' } },
      ],
    }],
  }],
};

test('scoreboard: a tie leg carries leg number, per-side aggregates and the decided winner', () => {
  const [f] = adaptScoreboard(tieScoreboard, 'uefa.champions');
  expect(f.leg).toBe(2);
  expect(f.home.agg).toBe(0);
  expect(f.away.agg).toBe(2);
  expect(f.tieCompleted).toBe(true);
  expect(f.tieWinnerId).toBe('490');
});

test('scoreboard: an ordinary fixture carries null tie fields — nothing invented', () => {
  const [f] = adaptScoreboard(scoreboard, 'sco.1');
  expect(f.leg).toBeNull();
  expect(f.home.agg).toBeNull();
  expect(f.tieCompleted).toBeNull();
  expect(f.tieWinnerId).toBeNull();
});

test('scoreboard: an undecided tie (leg 1 played) reports completed false and no winner', () => {
  const undecided = JSON.parse(JSON.stringify(tieScoreboard));
  undecided.events[0].series = { completed: false, totalCompetitions: 2, competitors: [
    { id: '2528', winner: false }, { id: '490', winner: false },
  ] };
  undecided.events[0].competitions[0].leg = { value: 1, displayValue: '1st Leg' };
  const [f] = adaptScoreboard(undecided, 'uefa.champions');
  expect(f.leg).toBe(1);
  expect(f.tieCompleted).toBe(false);
  expect(f.tieWinnerId).toBeNull();
});
