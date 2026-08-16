// Collapse (spec §13.21, task 1 of the elegance branch): the measured-
// height glide for accordion content that can change size WHILE open (a
// drawer opens on a skeleton, then grows once real content lands — the
// whole point is that it never juts). Ships INERT this task — nothing
// adopts it yet — but two later tasks wire it straight into the fixture
// drawer and the bottom sheet, so read Collapse.jsx's header comment
// (the children/lazy-mount contract) before treating this as decorative.
//
// jsdom has no ResizeObserver, and CSS transitions never run outside a
// real browser, so these tests assert states and DOM structure, not
// pixels or timing: the "no RO" fallback IS the whole design for that
// path (see Collapse.jsx) — and it happens to be exactly what jsdom
// exercises for free. The RO observe/disconnect wiring itself is checked
// with a LOCAL mock in the one test that needs it, not a global mock —
// a global ResizeObserver mock would silently move every other test onto
// the measured-px code path instead of the fallback the guard exists for.
import { act, render } from '@testing-library/react';
import Collapse from './Collapse.jsx';

test('open renders children, height resolves to auto (the no-ResizeObserver fallback path in jsdom)', () => {
  const { container, getByText } = render(
    <Collapse open><p>Content</p></Collapse>,
  );
  expect(getByText('Content')).toBeInTheDocument();
  expect(container.firstChild.style.height).toBe('auto');
});

test('closed still renders passed children in the DOM, at height 0', () => {
  const { container, getByText } = render(
    <Collapse open={false}><p>Content</p></Collapse>,
  );
  expect(getByText('Content')).toBeInTheDocument();
  expect(container.firstChild.style.height).toBe('0px');
});

test('the outer element carries the collapse-glide transition hook and overflow-hidden', () => {
  const { container } = render(<Collapse open={false}>x</Collapse>);
  expect(container.firstChild).toHaveClass('collapse-glide', 'overflow-hidden');
});

test('an extra className merges onto the outer element', () => {
  const { container } = render(<Collapse open className="mt-4">x</Collapse>);
  expect(container.firstChild).toHaveClass('mt-4');
});

test('toggling open re-renders without crashing and flips the fallback height each way', () => {
  const { container, rerender } = render(<Collapse open={false}>x</Collapse>);
  expect(container.firstChild.style.height).toBe('0px');
  rerender(<Collapse open>x</Collapse>);
  expect(container.firstChild.style.height).toBe('auto');
  rerender(<Collapse open={false}>x</Collapse>);
  expect(container.firstChild.style.height).toBe('0px');
});

test('observes the inner content on mount and disconnects on unmount (local ResizeObserver mock)', () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  class FakeResizeObserver {
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
  }
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = FakeResizeObserver;

  const { unmount } = render(<Collapse open><p>Content</p></Collapse>);
  expect(observe).toHaveBeenCalledTimes(1);
  unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);

  globalThis.ResizeObserver = original;
});

// --- review round 1 (HIGH fixes): leaving 'auto' must always pin a real
// painted px first — via a DIRECT node write, since React batches state
// writes in one effect into a single commit whose intermediate value never
// paints. These use a local callback-capturing RO mock; they assert the
// observable state machine (first fire = measurement only; later fires
// glide to concrete px), not real paint timing, which only a browser has.

test("the first ResizeObserver fire is pure measurement — an initially-open Collapse stays at 'auto', no self-glide on mount", () => {
  let roCallback;
  class CapturingRO {
    constructor(cb) { roCallback = cb; }

    observe = vi.fn();

    disconnect = vi.fn();

    unobserve = vi.fn();
  }
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = CapturingRO;
  try {
    const { container } = render(<Collapse open><p>Content</p></Collapse>);
    act(() => { roCallback(); });
    expect(container.firstChild.style.height).toBe('auto');
  } finally {
    globalThis.ResizeObserver = original;
  }
});

test('a later content-size change while settled open glides to the new measured px (auto is left via the pin-then-glide flip)', () => {
  let roCallback;
  class CapturingRO {
    constructor(cb) { roCallback = cb; }

    observe = vi.fn();

    disconnect = vi.fn();

    unobserve = vi.fn();
  }
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = CapturingRO;
  try {
    const { container } = render(<Collapse open><p>Content</p></Collapse>);
    const inner = container.firstChild.firstChild;
    Object.defineProperty(inner, 'offsetHeight', { configurable: true, value: 80 });
    act(() => { roCallback(); }); // first fire: measurement only
    expect(container.firstChild.style.height).toBe('auto');
    Object.defineProperty(inner, 'offsetHeight', { configurable: true, value: 200 });
    act(() => { roCallback(); }); // growth: glides to the new concrete px
    expect(container.firstChild.style.height).toBe('200px');
  } finally {
    globalThis.ResizeObserver = original;
  }
});
