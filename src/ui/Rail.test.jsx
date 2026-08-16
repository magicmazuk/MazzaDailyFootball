// The rail primitive (squad-visual branch, Aug 2026, task 3): a horizontal
// scroller with no visible scrollbars and an edge-fade affordance. jsdom
// never lays out real scrollWidth/clientWidth, so the dynamic fade-toggling
// behaviour lives entirely in the pure maskState() helper, tested directly
// here — the component test only covers what jsdom CAN tell us: children
// render, and the scroll container carries the CSS hook class that kills
// the native scrollbar.
import { render, screen } from '@testing-library/react';
import Rail, { maskState } from './Rail.jsx';

test('renders its children', () => {
  render(<Rail><span>Shirt one</span><span>Shirt two</span></Rail>);
  expect(screen.getByText('Shirt one')).toBeInTheDocument();
  expect(screen.getByText('Shirt two')).toBeInTheDocument();
});

test('the scroll container carries the rail-scroll class (scrollbar-hiding CSS hook)', () => {
  const { container } = render(<Rail><span>A</span></Rail>);
  expect(container.querySelector('.rail-scroll')).toBeInTheDocument();
});

// --- maskState(scrollLeft, scrollWidth, clientWidth) ---
// left fade: there is content scrolled past on the left (scrollLeft > 4).
// right fade: there is more content ahead (scrollLeft < scrollWidth - clientWidth - 4).

test('content narrower than the container (nothing to scroll): no fade either edge', () => {
  expect(maskState(0, 200, 400)).toBe('none');
});

test('at the very start, wider than the container: right fade only', () => {
  expect(maskState(0, 1000, 400)).toBe('right');
});

test('scrolled to the very end: left fade only', () => {
  expect(maskState(600, 1000, 400)).toBe('left');
});

test('scrolled somewhere in the middle: both fades', () => {
  expect(maskState(300, 1000, 400)).toBe('both');
});

test('left boundary: scrollLeft exactly 4 does not fade, 5 does (isolated — right stays false throughout)', () => {
  // scrollWidth - clientWidth = 4, so the right-fade term (scrollLeft < 0) is
  // false for every non-negative scrollLeft used here — only the left term moves.
  expect(maskState(4, 1000, 996)).toBe('none');
  expect(maskState(5, 1000, 996)).toBe('left');
});

test('right boundary: scrollLeft 0 against threshold 0 does not fade, threshold 1 does (isolated — left stays false throughout)', () => {
  // scrollLeft stays 0 throughout, so the left-fade term (0 > 4) is always
  // false — only the right term's threshold (scrollWidth - clientWidth - 4) moves.
  expect(maskState(0, 404, 400)).toBe('none');
  expect(maskState(0, 405, 400)).toBe('right');
});
