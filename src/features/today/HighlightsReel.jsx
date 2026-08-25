// The highlights reel (spec §13.36, H-A): fresh MOTD/Sportscene episodes
// as quiet listing rows on Today — show name, a relative-day context line,
// and the iPlayer deep link at the right margin. Self-contained like
// Papers: fetches for itself, owns its own <section>, and renders nothing
// at all when no episode is fresh — the notice IS the notification, and it
// expires by itself (no push, no badge, no placeholder; §13.36 exempts
// absence here from the one-line law).
import { useHighlights } from '../../data/queries.js';
import { freshEpisodes, londonDate } from '../../domain/highlights.js';
import SectionLabel from '../../ui/SectionLabel.jsx';

const DAY_MS = 24 * 60 * 60 * 1000;

// The broadsheet's relative day, on London's calendar (the day the
// broadcast means): Tonight, Last night, else the weekday name — 36h
// freshness can reach at most two London days back.
function relDay(firstBroadcast, now) {
  const day = londonDate(firstBroadcast);
  if (day === londonDate(now)) return 'Tonight';
  if (day === londonDate(new Date(now.getTime() - DAY_MS))) return 'Last night';
  return new Date(firstBroadcast).toLocaleDateString('en-GB',
    { weekday: 'long', timeZone: 'Europe/London' });
}

export default function HighlightsReel() {
  const episodes = useHighlights();
  const now = new Date();
  const fresh = freshEpisodes(episodes, now);
  if (fresh.length === 0) return null;
  return (
    <section className="mt-8">
      <SectionLabel muted>The highlights</SectionLabel>
      {fresh.map(e => (
        <a key={e.pid} href={e.url} target="_blank" rel="noopener noreferrer"
          className="block py-3 border-b border-rule last:border-b-0">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-serif text-[15px]">{e.show}</span>
            {/* The Full-table accent recipe, verbatim — the reel's only CTA. */}
            <span className="font-sans text-[10px] uppercase tracking-[.16em] text-accent shrink-0">
              iPlayer →
            </span>
          </span>
          <span className="block font-sans text-[10px] text-muted mt-0.5">
            {relDay(e.firstBroadcast, now)} · {e.comp.shortName}
          </span>
        </a>
      ))}
    </section>
  );
}
