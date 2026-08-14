// The field board (spec §13.10.2-4): pure derivation over fixtures via
// the field.js domain functions — champion flourish, still-in clubs
// (subdivided by entry tier when staggered), and out clubs (grouped by
// the round they fell in, most recent first). No fetching here.
import { Link } from 'react-router-dom';
import Crest from '../../ui/Crest.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import { survivalState, entryTiers, fallbackRoundLabel } from '../../domain/field.js';
import { prettifyRound } from '../../domain/round.js';

const roundLabel = round => prettifyRound(round) ?? fallbackRoundLabel(round);

// 2-line name clamp — no Tailwind line-clamp plugin is installed here, so
// this is the plain CSS box-clamp technique applied inline.
const clampStyle = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
};

function InCell({ comp, club, followedIds }) {
  return (
    <Link to={`/team/${comp.id}/${club.teamId}`} className="flex flex-col items-center text-center">
      <Crest side={club} size={38} />
      <span style={clampStyle} className="font-sans text-[9px] text-center leading-tight mt-1.5">
        {club.name}
        {followedIds.has(club.teamId) && <span className="text-accent ml-1">★</span>}
      </span>
    </Link>
  );
}

function InGrid({ comp, clubs, followedIds }) {
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-5">
      {clubs.map(club => <InCell key={club.teamId} comp={comp} club={club} followedIds={followedIds} />)}
    </div>
  );
}

export default function FieldBoard({ fixtures, comp, followedIds }) {
  if (!fixtures || fixtures.length === 0) {
    return <p className="text-muted">The draw hasn&apos;t been made yet.</p>;
  }

  const { in: inClubs, out, champion } = survivalState(fixtures, { singleLeg: comp.country !== 'Europe' });
  const tiers = entryTiers(fixtures);
  const inTeamIds = new Set(inClubs.map(c => c.teamId));
  // >1 tier in the raw entry-tier breakdown means entries staggered — use
  // sub-labels even if elimination has since emptied one of the tiers.
  const multiTier = tiers.length > 1;
  const inTierGroups = tiers
    .map(t => ({ round: t.round, clubs: t.clubs.filter(c => inTeamIds.has(c.teamId)) }))
    .filter(t => t.clubs.length > 0);
  // entryTiers only groups a club under a round when its EARLIEST fixture
  // carries one (field.js: a null-round fixture is invisible to tiering).
  // A club whose first appearance happened to be an unrounded fixture but
  // who is still `in` would otherwise never be drawn anywhere — collect
  // any survivor absent from every tier and give it its own untiered grid
  // so the crest count always matches the "Still in — N" total.
  const tieredTeamIds = new Set(inTierGroups.flatMap(t => t.clubs.map(c => c.teamId)));
  const untieredClubs = inClubs.filter(c => !tieredTeamIds.has(c.teamId));
  const outCount = out.reduce((n, g) => n + g.clubs.length, 0);

  return (
    <div>
      {champion && (
        <div className="flex flex-col items-center text-center py-6 mb-6 border-b border-rule">
          <Link to={`/team/${comp.id}/${champion.teamId}`}>
            <Crest side={champion} size={46} />
          </Link>
          <span className="font-sans text-[9px] uppercase tracking-[.2em] text-accent mt-3">WINNERS</span>
          <Link to={`/team/${comp.id}/${champion.teamId}`} className="font-serif text-[17px] mt-1">
            {champion.name}
          </Link>
        </div>
      )}

      {inClubs.length > 0 && (
        <section className="mb-8">
          <SectionLabel>Still in — {inClubs.length}</SectionLabel>
          {multiTier
            ? (
              <>
                {inTierGroups.map(t => (
                  <div key={t.round} className="mb-6 last:mb-0">
                    <p className="font-sans text-[9px] uppercase tracking-[.14em] text-muted mb-3">
                      {roundLabel(t.round)} entrants · {t.clubs.length}
                    </p>
                    <InGrid comp={comp} clubs={t.clubs} followedIds={followedIds} />
                  </div>
                ))}
                {untieredClubs.length > 0 && (
                  <div className="mb-6 last:mb-0">
                    <p className="font-sans text-[9px] uppercase tracking-[.14em] text-muted mb-3">
                      Also in · {untieredClubs.length}
                    </p>
                    <InGrid comp={comp} clubs={untieredClubs} followedIds={followedIds} />
                  </div>
                )}
              </>
            )
            : <InGrid comp={comp} clubs={inClubs} followedIds={followedIds} />}
        </section>
      )}

      {out.length > 0 && (
        <section>
          <SectionLabel muted>Out — {outCount}</SectionLabel>
          {[...out].reverse().map(g => (
            <div key={g.round} className="mb-5 last:mb-0">
              <p className="font-sans text-[9px] uppercase tracking-[.14em] text-muted mb-3">
                Fell in the {roundLabel(g.round)}
              </p>
              <div className="grid grid-cols-6 gap-x-2 gap-y-3">
                {g.clubs.map(club => (
                  <Link key={club.teamId} to={`/team/${comp.id}/${club.teamId}`} aria-label={club.name}
                    className="grayscale opacity-40 flex justify-center">
                    <Crest side={club} size={24} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
