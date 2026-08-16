// The player page (spec §13.16, design C "The splits"): stats as chunky
// two-tone proportion blocks for outfield players, saves/clean sheets for
// keepers, discipline as three plain numbers, rating/minutes as quiet
// gauge lines. Identity is entirely typographic — no portrait, roundel or
// initials mark anywhere (binding design note: no player photos exist in
// any feed).
import { Link, useLocation, useParams } from 'react-router-dom';
import { byId } from '../../domain/competitions.js';
import { usePlayer } from '../../data/queries.js';
import { isKeeper } from '../../data/player.js';
import SectionLabel from '../../ui/SectionLabel.jsx';

// A two-tone proportion bar with a big headline number on the left — the
// shots/passes split-block pattern from the mockup's design C. Only ever
// rendered when the underlying totalShots/totalPasses stat is non-null;
// callers gate that.
function SplitBlock({ big, bigLabel, onPct, caption }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="w-16 shrink-0">
        <div className="text-[21px] tabular-nums">{big}</div>
        <div className="font-sans text-[9px] uppercase tracking-[.14em] text-muted mt-0.5">{bigLabel}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-[26px] rounded-[4px] flex overflow-hidden">
          <i className="block h-full bg-ink" style={{ width: `${onPct}%` }} />
          <i className="block h-full bg-rule" style={{ width: `${100 - onPct}%` }} />
        </div>
        <div className="font-sans text-[9px] uppercase tracking-[.14em] text-muted mt-1">{caption}</div>
      </div>
    </div>
  );
}

// A row of plain numbers (discipline, keeper). Each item renders only
// when its value is non-null — "null stats don't render", never a
// fabricated zero-row for a stat the feed didn't publish for this player.
function PlainNumbers({ items }) {
  const present = items.filter(it => it.value != null);
  if (!present.length) return null;
  return (
    <div className="flex gap-6 my-3">
      {present.map(it => (
        <div key={it.label}>
          <div className={`text-[21px] tabular-nums ${it.accent ? 'text-accent' : ''}`}>{it.value}</div>
          <div className="font-sans text-[9px] uppercase tracking-[.14em] text-muted mt-0.5">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

// Rating: a label/number top row plus a 3px accent bar at rating*10%.
function RatingGauge({ rating }) {
  return (
    <div className="my-3.5">
      <div className="flex justify-between items-baseline font-sans text-[10px] uppercase
                      tracking-[.12em] text-muted mb-1.5">
        <span>Rating</span>
        <span className="font-serif normal-case tracking-normal text-[16px] text-ink tabular-nums">
          {rating}
        </span>
      </div>
      <div className="h-[3px] bg-rule rounded-sm overflow-hidden">
        <i className="block h-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, rating * 10))}%` }} />
      </div>
    </div>
  );
}

// Minutes: one combined line ("Minutes played — 172′ of 180′") over a
// plain ink bar at minutes/(appearances*90).
function MinutesGauge({ minutes, of }) {
  const pct = of > 0 ? Math.max(0, Math.min(100, (minutes / of) * 100)) : 0;
  return (
    <div className="my-3.5">
      <p className="font-sans text-[10px] uppercase tracking-[.12em] text-muted mb-1.5">
        Minutes played — {minutes}′ of {of}′
      </p>
      <div className="h-[3px] bg-rule rounded-sm overflow-hidden">
        <i className="block h-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// The full profile body ("The Splits" itself): attacking/keeper stat
// blocks, discipline, rating and minutes gauges — everything below
// PlayerScreen's page-level header (kicker/name/bio line, which stays
// page-only). Extracted (spec §13.18.3) so PlayerSheet can render the
// exact same content inline when it expands, rather than navigating away
// from the match/team context. Callers pass comp too, but the splits are
// driven entirely by bio/stats, so the signature doesn't take it.
export function Splits({ bio, stats }) {
  const keeper = isKeeper(bio);

  const showShots = stats?.totalShots != null;
  const shotsOn = stats?.shotsOnTarget ?? 0;
  const shotsOnPct = showShots && stats.totalShots > 0 ? (shotsOn / stats.totalShots) * 100 : 0;

  const showPasses = stats?.totalPasses != null;
  const passesOn = stats?.accuratePasses ?? 0;
  // Clamp the pass fraction to [0,1] before turning it into a bar width
  // (backlog #86): passPct is documented as a 0-1 fraction and today's feed
  // always honours that, but an out-of-range value (a future 0-100 feed, or
  // any other anomaly) would otherwise overshoot the bar past 100% or push
  // the remainder negative.
  const passPctFraction = stats?.passPct != null ? Math.max(0, Math.min(1, stats.passPct)) : null;
  const passesPct = passPctFraction != null
    ? passPctFraction * 100
    : (showPasses && stats.totalPasses > 0 ? (passesOn / stats.totalPasses) * 100 : 0);

  const showCards = stats?.yellowCards != null || stats?.redCards != null;
  const cardsCount = (stats?.yellowCards ?? 0) + (stats?.redCards ?? 0);

  const showAttacking = !keeper && (showShots || showPasses);
  const showKeeperStats = keeper
    && (stats?.saves != null || stats?.cleanSheets != null || stats?.goalsConceded != null);
  const showDiscipline = stats?.foulsCommitted != null || showCards || stats?.effectiveTackles != null;
  const showRating = stats?.rating != null;
  const showMinutes = stats?.minutes != null && stats?.appearances != null && stats.appearances > 0;

  return (
    <>
      {showAttacking && (
        <section className="mb-8">
          <SectionLabel>Attacking</SectionLabel>
          {showShots && (
            <SplitBlock big={stats.goals ?? 0} bigLabel="goals" onPct={shotsOnPct}
              caption={`${stats.totalShots} shots — ${shotsOn} on target`} />
          )}
          {showPasses && (
            <SplitBlock big={passesOn} bigLabel="passes on" onPct={passesPct}
              caption={`${stats.totalPasses} attempted — ${passesPct.toFixed(1)}%`} />
          )}
        </section>
      )}

      {showKeeperStats && (
        <section className="mb-8">
          <SectionLabel>Keeper</SectionLabel>
          <PlainNumbers items={[
            { label: 'Saves', value: stats.saves },
            { label: 'Clean sheets', value: stats.cleanSheets },
            { label: 'Conceded', value: stats.goalsConceded },
          ]} />
        </section>
      )}

      {showDiscipline && (
        <section className="mb-8">
          <SectionLabel>Discipline &amp; defence</SectionLabel>
          <PlainNumbers items={[
            { label: 'Fouls', value: stats.foulsCommitted },
            { label: 'Cards', value: showCards ? cardsCount : null, accent: (stats.redCards ?? 0) > 0 },
            { label: 'Tackles won', value: stats.effectiveTackles },
          ]} />
        </section>
      )}

      {showRating && <RatingGauge rating={stats.rating} />}
      {showMinutes && <MinutesGauge minutes={stats.minutes} of={stats.appearances * 90} />}
    </>
  );
}

export default function PlayerScreen() {
  const { compId, playerId } = useParams();
  const location = useLocation();
  const comp = byId(compId);
  // Gated on bio alone (hotfix, Aug 2026): a stats-only failure (e.g. the
  // statistics feed 404ing under a UEFA/cup comp) must never blank the
  // page — every stat section below already null-renders when stats is
  // absent, so there is a full page to show as long as bio resolved.
  const { bio, stats, isLoading } = usePlayer(comp ?? { id: 'none', source: 'bbc' }, playerId);

  if (!comp) return <p className="text-muted">Unknown competition.</p>;
  if (isLoading) return <p className="text-muted">Loading player…</p>;
  if (!bio) return <p className="text-muted">Player unavailable right now.</p>;

  const club = location.state?.club ?? null;

  const bioParts = [club, bio.nationality, bio.age, bio.heightDisplay,
    stats?.appearances != null ? `${stats.appearances} games` : null].filter(Boolean);

  return (
    <main>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-muted">
        {comp.name}{bio.position && ` · ${bio.position}`}
      </p>
      <div className="flex items-baseline gap-3 mt-3">
        <h1 className="text-[26px]">{bio.name}</h1>
        {bio.shirt != null && <span className="font-sans text-[12px] text-muted">№ {bio.shirt}</span>}
      </div>
      {bioParts.length > 0 && (
        <p className="font-sans text-[11px] text-muted mt-1 mb-6">{bioParts.join(' · ')}</p>
      )}

      <Splits bio={bio} stats={stats} comp={comp} />
    </main>
  );
}
