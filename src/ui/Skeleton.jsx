// Skeleton placeholders (spec §13.21, task 1 of the elegance branch): drawer-
// tone bars/blocks in the shape of coming content, gently pulsing while a
// genuine fetch is in flight. Ships INERT this task — no screen renders
// these yet — but the contract other tasks build on is: skeletons appear
// ONLY during real loading (cached content must render instantly, no
// placeholder flash) and are swapped for the loaded content behind a
// 160ms `.xfade-in` crossfade (src/index.css), never a hard cut.
//
// aria: both pieces are `aria-hidden="true"` — they carry no text a screen
// reader could read anyway, and the app's convention is that the section
// around a skeleton communicates "loading" (or says nothing) through its
// own copy, not through the placeholder. If a caller wants that announced,
// that's a one-line addition on their side (e.g. a visually-hidden status
// string), not something Skeleton itself should assume.
export function SkeletonLines({ lines = 3, widths = ['85%', '60%', '72%'] }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key -- static placeholder bars, no reorder/identity concern
          key={i}
          className="skeleton-pulse bg-rule h-[11px] rounded-[2px] my-2"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

export function SkeletonBlock({ className = '' }) {
  return <div aria-hidden="true" className={`skeleton-pulse bg-rule ${className}`} />;
}
