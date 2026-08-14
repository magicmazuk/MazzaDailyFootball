// One YouTube highlights card for a finished fixture (spec §13.9), with
// dismiss-to-next behaviour: an ✕ steps to the next candidate video;
// dismissing the last one removes the card entirely rather than leaving
// an empty shell.
import { useState } from 'react';
import SectionLabel from '../../ui/SectionLabel.jsx';

export default function VideoCard({ videos }) {
  const [index, setIndex] = useState(0);
  if (!videos?.length || index >= videos.length) return null;
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
