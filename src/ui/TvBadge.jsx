import { tvShortLabel } from '../data/tv.js';

// Quiet Broadsheet chips — muted, bordered, no brand colours (colour is
// information, and "on TV" is metadata, not an event).
export default function TvBadge({ tv }) {
  if (!tv?.length) return null;
  return (
    <span className="inline-flex gap-1">
      {tv.map(ch => (
        <span key={ch}
          className="font-sans text-[8.5px] uppercase tracking-[.12em] text-muted
                     border border-rule rounded-[3px] px-1 py-px leading-none">
          {tvShortLabel(ch)}
        </span>
      ))}
    </span>
  );
}
