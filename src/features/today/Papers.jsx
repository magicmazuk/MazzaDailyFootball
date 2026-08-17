// The papers (spec §13.19.2) — two quiet news blocks on Today, top Celtic
// story and top British-football story, each expandable to five, from BBC
// Sport RSS via the news proxy. Self-contained: fetches its own data via
// useNews rather than taking props, so TodayView only has to place it.
import { useState } from 'react';
import { useNews } from '../../data/queries.js';
import { timeAgo } from '../../data/news.js';
import Collapse from '../../ui/Collapse.jsx';
import SectionLabel from '../../ui/SectionLabel.jsx';
import { SkeletonLines } from '../../ui/Skeleton.jsx';

// 2-line standfirst clamp — no Tailwind line-clamp plugin installed here,
// so this is the same plain CSS box-clamp technique FieldBoard uses.
const clampStyle = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
};

function Meta({ publishedAt }) {
  const ago = timeAgo(publishedAt);
  return (
    <p className="font-sans text-[9.5px] uppercase tracking-[.14em] text-muted">
      BBC Sport{ago && ` · ${ago}`}
    </p>
  );
}

function TopStory({ item }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="flex-1 min-w-0">
        <a href={item.link} target="_blank" rel="noopener noreferrer"
          className="block font-serif text-[16.5px] leading-snug hover:text-accent">
          {item.title}
        </a>
        {item.description && (
          <p style={clampStyle} className="font-serif text-[12.5px] text-muted mt-2">
            {item.description}
          </p>
        )}
        <div className="mt-2.5">
          <Meta publishedAt={item.publishedAt} />
        </div>
      </div>
      {item.thumbnail && (
        <img src={item.thumbnail} alt="" className="w-[76px] h-[76px] rounded-[2px] object-cover shrink-0" />
      )}
    </div>
  );
}

function CompactRow({ item }) {
  return (
    <div className="py-2">
      <a href={item.link} target="_blank" rel="noopener noreferrer"
        className="block font-serif text-[14px] leading-snug hover:text-accent">
        {item.title}
      </a>
      <div className="mt-1">
        <Meta publishedAt={item.publishedAt} />
      </div>
    </div>
  );
}

function Block({ label, feed }) {
  const [revealed, setRevealed] = useState(false);
  // Lazy-ONCE mounting (fix round 1, HIGH): the revealed rows stay mounted
  // once shown, even after "− fewer" closes them, so the Collapse glides
  // shut around real content — see FixtureRow's fuller comment on the
  // same fix.
  const [everRevealed, setEverRevealed] = useState(false);
  // isLoading (never isFetching): React Query v5 defines isLoading as
  // isPending && isFetching — true only while there's no cached data yet.
  // What actually keeps a re-visit skeleton-free is cache PRESENCE, not
  // staleTime: isPending flips false the instant this query has ever
  // resolved, so a stale-but-cached re-visit still refetches in the
  // background (isFetching true) but isLoading stays false throughout.
  const { data, isLoading } = useNews(feed);
  const items = data?.items ?? [];
  const [top, ...rest] = items;
  // Per-block unique id — Block renders twice (celtic, football) — for
  // aria-controls to target unambiguously.
  const moreId = `papers-${feed}-more`;

  return (
    <div>
      <p className="font-sans text-[9px] uppercase tracking-[.14em] text-muted mb-3">{label}</p>
      {isLoading && <SkeletonLines lines={2} widths={['92%', '55%']} />}
      {!isLoading && !top && <p className="text-muted">The papers haven&apos;t arrived.</p>}
      {!isLoading && top && (
        <div className="xfade-in">
          <TopStory item={top} />
          {rest.length > 0 && (
            <div className="mt-4">
              <button type="button"
                onClick={() => { setRevealed(r => !r); setEverRevealed(true); }}
                aria-expanded={revealed} aria-controls={moreId}
                className="font-sans text-[10px] uppercase tracking-[.16em] text-accent">
                {revealed ? '− fewer' : `+ ${rest.length} more`}
              </button>
              <Collapse open={revealed}>
                {everRevealed && (
                  <div id={moreId} className="mt-3 divide-y divide-rule/60">
                    {rest.map(item => <CompactRow key={item.id} item={item} />)}
                  </div>
                )}
              </Collapse>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Papers() {
  return (
    <section className="mt-8">
      <SectionLabel muted>The papers</SectionLabel>
      <div className="mt-5">
        <Block label="Celtic" feed="celtic" />
      </div>
      <div className="mt-10">
        <Block label="British football" feed="football" />
      </div>
    </section>
  );
}
