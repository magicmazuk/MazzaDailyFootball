// The draw invitation (spec §8.2, §13.14) — a quiet card on Today that
// announces an unrevealed cup draw instead of leaking its pairings. One
// card per unrevealedDraws() entry (TodayScreen wiring); tapping it (the
// whole card is the link) opens the ceremony at /draw/:compId/:round.
import { Link } from 'react-router-dom';

export default function DrawInvitation({ draw }) {
  const { comp, round, roundLabel, ties } = draw;
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
        {ties.length} ties unrevealed
      </p>
      <p className="font-sans text-[10.5px] uppercase tracking-[.14em] text-accent text-center">
        Reveal them →
      </p>
    </Link>
  );
}
