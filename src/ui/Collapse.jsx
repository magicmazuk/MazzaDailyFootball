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
  const lastPxRef = useRef(0); // last measured content height, for the auto->0 close flip

  const [height, setHeight] = useState(() => (open ? 'auto' : 0));

  // No ResizeObserver in this environment: nothing to measure, nothing to
  // glide from/to. Reflect the open state directly — see header comment.
  useLayoutEffect(() => {
    if (hasResizeObserver()) return undefined;
    setHeight(open ? 'auto' : 0);
    return undefined;
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
      lastPxRef.current = measured;
      setHeight((prev) => (prev === 0 ? prev : `${measured}px`));
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
      // 0 -> measured px: the transition needs two concrete numbers.
      const measured = inner.offsetHeight;
      lastPxRef.current = measured;
      setHeight(`${measured}px`);
      const onTransitionEnd = (event) => {
        if (event.target === outer && event.propertyName === 'height') {
          // Settle on 'auto': resilience so a growth event this glide
          // somehow missed still can't clip content under overflow-hidden.
          setHeight('auto');
        }
      };
      outer.addEventListener('transitionend', onTransitionEnd);
      return () => outer.removeEventListener('transitionend', onTransitionEnd);
    }

    // Closing: 'auto' -> 0 does not transition (no numeric start value to
    // interpolate from). Pin to the last measured px, force a reflow so
    // the browser commits that as a real starting value, then drop to 0
    // so the glide has somewhere concrete to animate from.
    setHeight(`${lastPxRef.current}px`);
    // eslint-disable-next-line no-unused-expressions -- reading offsetHeight forces the synchronous reflow the comment above describes
    outer.offsetHeight;
    setHeight(0);
    return undefined;
  }, [open]);

  return (
    <div ref={outerRef} className={`overflow-hidden collapse-glide ${className}`} style={{ height }}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
