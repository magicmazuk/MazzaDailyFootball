// One YouTube highlights card for a finished fixture (spec §13.9), with
// dismiss-to-next behaviour: an ✕ steps to the next candidate video;
// dismissing the last one removes the card entirely rather than leaving
// an empty shell — UNLESS the caller opts into `exhaustedLine` (review
// round 2, LOW fix, spec §13.20.3): the scout film would otherwise leave a
// permanently blank section once every video's been dismissed, with no
// affordance telling the reader that was deliberate rather than broken.
// `exhaustedLine` is optional and only changes what happens once EVERY
// video is gone (index >= videos.length) — an empty `videos` list from the
// very start still renders nothing regardless, and MatchRoom passes
// nothing at all, so its behaviour (null, same as before this prop
// existed) is byte-identical.
import { useState } from 'react';
import SectionLabel from '../../ui/SectionLabel.jsx';

export default function VideoCard({ videos, exhaustedLine }) {
  const [index, setIndex] = useState(0);
  if (!videos?.length) return null;
  if (index >= videos.length) {
    return exhaustedLine
      ? <p className="font-sans text-[11px] text-muted mb-8">{exhaustedLine}</p>
      : null;
  }
  const video = videos[index];
  return (
    <section className="mb-8 relative">
      <SectionLabel muted>Video</SectionLabel>
      <button type="button" aria-label="Dismiss video" onClick={() => setIndex(i => i + 1)}
        className="absolute top-0 right-0 font-sans text-[12px] text-muted leading-none">
        ✕
      </button>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${video.videoId}`}
        title={video.title}
        allowFullScreen
        className="w-full aspect-video border border-rule"
      />
      <p className="mt-2 text-[13px] truncate">{video.title}</p>
    </section>
  );
}
