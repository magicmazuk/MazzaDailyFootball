// The draw invitation (spec §8.2, §13.14, §13.15) — a quiet card on Today
// that announces an unrevealed draw instead of leaking its pairings. One
// card per unrevealedDraws() entry (TodayScreen wiring); tapping it (the
// whole card is the link) opens the ceremony.
//
// The `club` variant (spec §13.15) renders for unrevealedPhaseDraws()
// entries instead — `draw.club` is present exactly on those (tie-draw
// entries never carry a `club` field), so this switches on that rather
// than a separate prop: club crest + "{CLUB}'S DRAW IS IN", the comp/round
// line, an opponent count in place of the tie count, and a link to the
// club-centric opponents route (/draw/:compId/:round/:teamId) instead of
// the round-wide one.
import { Link } from 'react-router-dom';
import Crest from '../../ui/Crest.jsx';

export default function DrawInvitation({ draw }) {
  const { comp, round, roundLabel, club } = draw;

  if (club) {
    return (
      <Link to={`/draw/${comp.id}/${round}/${club.teamId}`}
        className="block border border-ink rounded-none bg-paper p-5 mb-4">
        <div className="flex justify-center mb-3">
          <Crest side={club} size={30} />
        </div>
        <p className="font-sans text-[10px] uppercase tracking-[.22em] text-accent text-center mb-2">
          {club.name.toUpperCase()}'S DRAW IS IN
        </p>
        <p className="font-serif text-[16px] text-center">
          {comp.name} · {roundLabel}
        </p>
        <p className="font-sans text-[10.5px] text-muted text-center mt-1 mb-3">
          {draw.fixtures.length} opponents
        </p>
        <p className="font-sans text-[10.5px] uppercase tracking-[.14em] text-accent text-center">
          Reveal them →
        </p>
      </Link>
    );
  }

  // tieCount is the deduped pairing count (draws.js dedupePairings) — draw
  // is unrevealedDraws' own shape, whose `ties` stays the FULL both-legs
  // fixture list (hiding/seen-marking depend on it); tieCount is what the
  // card shows so a two-legged round never reads as double its real size.
  const { tieCount } = draw;
  return (
    <Link to={`/draw/${comp.id}/${round}`}
      className="block border border-ink rounded-none bg-paper p-5 mb-4">
      <p aria-hidden="true" className="text-center tracking-[.3em] text-[10px] text-ink mb-3">
        ● ● ● ●
      </p>
      <p className="font-sans text-[10px] uppercase tracking-[.22em] text-accent text-center mb-2">
        THE DRAW IS IN
      </p>
      <p className="font-serif text-[16px] text-center">
        {comp.name} · {roundLabel}
      </p>
      <p className="font-sans text-[10.5px] text-muted text-center mt-1 mb-3">
        {tieCount} ties unrevealed
      </p>
      <p className="font-sans text-[10.5px] uppercase tracking-[.14em] text-accent text-center">
        Reveal them →
      </p>
    </Link>
  );
}
