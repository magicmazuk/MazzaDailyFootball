// Collapse — the measured-height glide (spec §13.21, task 1 of the elegance
// branch). Ships INERT this task: nothing calls it yet, but two later tasks
// wire it directly into the fixture drawer and the bottom sheet, so the
// contract below is load-bearing, not decorative.
//
// CONTRACT
// - `open` drives everything; `children` are rendered UNCONDITIONALLY —
//   Collapse itself never gates on `open`. A closed Collapse with children
//   still renders them in the DOM, just clipped to height 0 under
//   overflow-hidden. That's deliberate: it's what lets the height glide
//   smoothly closed->open with no mount flash on the way in.
// - LAZY MOUNTING (skipping the cost of rendering expensive children while
//   closed) is therefore the CALLER's concern, not Collapse's: gate the
//   children yourselves before handing them over —
//     <Collapse open={open}>{open && <ExpensiveDrawer/>}</Collapse>
//   Most current call sites in this app pass children unconditionally
//   (today's plain height:auto accordions) — that's still fine and is the
//   recommended default; only reach for the `open &&` gate above when
//   mount cost, not clipping, is the actual concern.
// - No aria of its own. The trigger (the button/row whose tap flips `open`)
//   carries aria-expanded, same as every accordion trigger in this app
//   already does — Collapse just owns the height, not the semantics.
// - jsdom (and any other ResizeObserver-less runtime) gets a plain
//   fallback: skip measurement entirely and snap straight to the relevant
//   end state (0 closed, 'auto' open). That guard IS the design for that
//   environment, not a test shim — never paper over it with a global
//   ResizeObserver mock (see Collapse.test.jsx's header comment for why).
import { useLayoutEffect, useRef, useState } from 'react';

function hasResizeObserver() {
  return typeof ResizeObserver !== 'undefined';
}

export default function Collapse({ open, children, className = '' }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const lastPxRef = useRef(0); // last measured content height, for the pin-then-glide flips
  const roInitializedRef = useRef(false); // RO always fires once on observe — that first fire is a measurement, never a glide

  const [height, setHeight] = useState(() => (open ? 'auto' : 0));
  // Mirror of the last COMMITTED height. The RO callback and close path
  // need to know it synchronously (to decide whether a pin-then-glide flip
  // is required) without the stale-closure/updater-fn contortions.
  const heightRef = useRef(height);
  const applyHeight = (v) => { heightRef.current = v; setHeight(v); };

  // No ResizeObserver in this environment: nothing to measure, nothing to
  // glide from/to. Reflect the open state directly — see header comment.
  useLayoutEffect(() => {
    if (hasResizeObserver()) return undefined;
    applyHeight(open ? 'auto' : 0);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyHeight is a stable-by-construction setter pair
  }, [open]);

  // Measurement: watch the inner content's height for as long as Collapse
  // is mounted, so a resize landing while open (skeleton -> real content)
  // has somewhere concrete to glide to instead of jumping. Ignored while
  // closed (height 0) — there's nothing to glide, and re-opening
  // re-measures fresh in the open/close effect below anyway.
  useLayoutEffect(() => {
    if (!hasResizeObserver()) return undefined;
    const inner = innerRef.current;
    if (!inner) return undefined;
    const ro = new ResizeObserver(() => {
      const measured = inner.offsetHeight;
      const prevPx = lastPxRef.current;
      lastPxRef.current = measured;
      // The first fire is ResizeObserver's mandatory on-observe callback —
      // pure measurement, never a glide (an initially-open Collapse must
      // not animate itself on mount).
      if (!roInitializedRef.current) {
        roInitializedRef.current = true;
        return;
      }
      const current = heightRef.current;
      if (current === 0) return; // closed: content changes move nothing
      if (current === 'auto') {
        // Settled at 'auto', so the box has ALREADY laid out at the new
        // size — but RO callbacks run before paint, so there's still time
        // to pin the OLD px straight onto the node (state can't do it:
        // React batches the two writes into one commit and the start
        // value never paints — review round 1, verified empirically),
        // force a reflow to commit it, then glide to the new value.
        const outer = outerRef.current;
        if (outer) {
          outer.style.height = `${prevPx}px`;
          // eslint-disable-next-line no-unused-expressions -- forces the reflow that commits the pinned start value
          outer.offsetHeight;
        }
        applyHeight(`${measured}px`);
      } else {
        // Mid-glide growth: retarget the running transition — both ends
        // are already concrete numbers.
        applyHeight(`${measured}px`);
      }
    });
    ro.observe(inner);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- observes the ref's current node once; open/close is handled by the effect below
  }, []);

  // Open/close choreography.
  useLayoutEffect(() => {
    if (!hasResizeObserver()) return undefined;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return undefined;

    if (open) {
      // Already settled open ('auto') — this is the mount-while-open case
      // (initial state is 'auto', nothing to glide from) — leave it be.
      if (heightRef.current === 'auto') return undefined;
      // 0 -> measured px: the transition needs two concrete numbers.
      const measured = inner.offsetHeight;
      lastPxRef.current = measured;
      applyHeight(`${measured}px`);
      const onTransitionEnd = (event) => {
        if (event.target === outer && event.propertyName === 'height') {
          // Settle on 'auto': resilience so a growth event this glide
          // somehow missed still can't clip content under overflow-hidden.
          applyHeight('auto');
        }
      };
      outer.addEventListener('transitionend', onTransitionEnd);
      return () => outer.removeEventListener('transitionend', onTransitionEnd);
    }

    // Closing: 'auto' -> 0 does not transition (no numeric start value to
    // interpolate from). Pin the last measured px DIRECTLY on the node —
    // not through state, which React would batch with the 0 below into a
    // single commit whose intermediate value never paints (review round 1,
    // verified empirically against this repo's React 19) — force a reflow
    // to commit it as the real starting value, then drop to 0 through
    // state so the glide has somewhere concrete to animate from.
    if (heightRef.current === 'auto') {
      outer.style.height = `${lastPxRef.current}px`;
      // eslint-disable-next-line no-unused-expressions -- forces the reflow that commits the pinned start value
      outer.offsetHeight;
    }
    applyHeight(0);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyHeight is a stable-by-construction setter pair
  }, [open]);

  return (
    <div ref={outerRef} className={`overflow-hidden collapse-glide ${className}`} style={{ height }}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
