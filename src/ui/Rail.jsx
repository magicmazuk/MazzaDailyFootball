// The rail primitive (squad-visual branch, Aug 2026, task 3): a horizontal
// scroller with no visible scrollbars, scroll-snap, and a dynamic edge-fade
// affordance so a swipeable strip never looks like a dead end. The
// scrollbar-hiding + snap CSS lives in src/index.css (.rail-scroll); this
// component only owns the fade, computed from a pure helper (maskState)
// so its four-way branch is unit-testable without jsdom's non-existent
// layout engine. Deliberately no programmatic smooth-scrolling anywhere —
// prefers-reduced-motion has nothing to override because there's nothing
// to override; scrolling is native touch/wheel/drag only.
import { useEffect, useRef, useState } from 'react';

// Pure: given a scroll container's current geometry, which edge(s) should
// fade to hint more content. Strict inequalities + the 4px slop absorb
// sub-pixel rounding so a fully-scrolled edge never flickers a phantom fade.
export function maskState(scrollLeft, scrollWidth, clientWidth) {
  const left = scrollLeft > 4;
  const right = scrollLeft < scrollWidth - clientWidth - 4;
  if (left && right) return 'both';
  if (left) return 'left';
  if (right) return 'right';
  return 'none';
}

const MASK_CLASS = {
  none: '',
  left: 'rail-mask-left',
  right: 'rail-mask-right',
  both: 'rail-mask-both',
};

export default function Rail({ children, className = '' }) {
  const ref = useRef(null);
  const [mask, setMask] = useState('none');

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setMask(maskState(el.scrollLeft, el.scrollWidth, el.clientWidth));
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
    // Re-attach when the child count changes too — a fresh squad list can
    // change scrollWidth without firing a scroll or resize event of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(children) ? children.length : 1]);

  return (
    <div ref={ref} className={`rail-scroll flex gap-3 overflow-x-auto ${MASK_CLASS[mask]} ${className}`}>
      {children}
    </div>
  );
}
