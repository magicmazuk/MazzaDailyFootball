// Round-first grouping for the competition Fixtures/Results tabs (Release
// 2.3 §C1): once at least one fixture in the list carries a round with a
// displayable label, the tab groups by round (order via field.js's
// roundOrder — ascending for Fixtures, reversed for Results) before
// falling back to the existing date-only breakdown within each round.
// Leagues never carry a displayable round — ESPN's season.slug is a
// year-prefixed SEASON name for them (rejected by both prettifyRound and
// fallbackRoundLabel; see round.js/field.js) and BBC's two league sources
// publish no round label at all — so they keep the flat, single-group
// date grouping unchanged: the returned group's `round`/`label` are null,
// which is what CompetitionScreen keys off to skip the round heading.
import { roundOrder, fallbackRoundLabel } from '../../domain/field.js';
import { prettifyRound } from '../../domain/round.js';

const OTHER_FIXTURES_LABEL = 'Other fixtures';

const roundLabel = round => prettifyRound(round) ?? fallbackRoundLabel(round);
const hasLabel = round => !!roundLabel(round);

function groupByDate(fixtures) {
  const groups = new Map();
  for (const f of fixtures) {
    const day = new Date(f.kickoff).toLocaleDateString('en-GB',
      { weekday: 'short', day: 'numeric', month: 'short' });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(f);
  }
  return [...groups.entries()];
}

// One group per round (in `order`, or reversed for the Results tab), each
// carrying its own date sub-grouping (`days`, shaped like groupByDate's
// old CompetitionScreen-local output: [[dayLabel, fixtures[]], ...]). A
// trailing 'Other fixtures' group collects any fixture whose round has no
// displayable label — a null round (BBC-merged cup fixtures all carry a
// round now; this is a safety net), or — belt and braces — a round slug
// that resolves to one despite appearing in roundOrder. When NO fixture
// in the list has a displayable round, returns a single group with a
// null round/label wrapping the plain date grouping, so leagues render
// exactly as they did before round-grouping existed.
export function groupFixturesByRound(fixtures, { reverse = false } = {}) {
  const list = fixtures ?? [];
  if (!list.some(f => hasLabel(f?.round))) {
    return [{ round: null, label: null, days: groupByDate(list) }];
  }

  const order = roundOrder(list).filter(hasLabel);
  const ordered = reverse ? [...order].reverse() : order;
  const byRound = new Map(ordered.map(r => [r, []]));
  const other = [];
  for (const f of list) {
    if (f?.round != null && byRound.has(f.round)) byRound.get(f.round).push(f);
    else other.push(f);
  }

  const groups = ordered.map(round => ({
    round, label: roundLabel(round), days: groupByDate(byRound.get(round)),
  }));
  if (other.length > 0) {
    groups.push({ round: null, label: OTHER_FIXTURES_LABEL, days: groupByDate(other) });
  }
  return groups;
}
