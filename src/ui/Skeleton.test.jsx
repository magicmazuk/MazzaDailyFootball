// Skeleton placeholders (spec §13.21, task 1 of the elegance branch): the
// only DOM a genuine loading state gets. No adopter wires these up yet —
// this component ships inert — but the shape has to be right for whichever
// drawer/section reaches for it next. Pulse timing itself is a CSS concern
// (.skeleton-pulse, src/index.css) and untestable here since jsdom never
// runs animations; these tests cover structure only: bar count, the
// width-cycling contract, and the aria-hidden contract (the caller's own
// section communicates "loading" to AT via its own means, if at all — see
// Skeleton.jsx's header comment).
import { render } from '@testing-library/react';
import { SkeletonBlock, SkeletonLines } from './Skeleton.jsx';

test('SkeletonLines renders 3 bars by default, each pulsing over drawer tone', () => {
  const { container } = render(<SkeletonLines />);
  const bars = container.querySelectorAll('.skeleton-pulse');
  expect(bars).toHaveLength(3);
  bars.forEach((bar) => {
    expect(bar).toHaveClass('bg-drawer', 'h-[11px]', 'rounded-[2px]');
  });
});

test('SkeletonLines honours a custom line count', () => {
  const { container } = render(<SkeletonLines lines={5} />);
  expect(container.querySelectorAll('.skeleton-pulse')).toHaveLength(5);
});

test('SkeletonLines cycles widths when there are more lines than widths supplied', () => {
  const { container } = render(<SkeletonLines lines={5} widths={['10%', '20%']} />);
  const bars = [...container.querySelectorAll('.skeleton-pulse')];
  expect(bars.map((b) => b.style.width)).toEqual(['10%', '20%', '10%', '20%', '10%']);
});

test('SkeletonLines defaults its widths to 85%/60%/72%', () => {
  const { container } = render(<SkeletonLines />);
  const bars = [...container.querySelectorAll('.skeleton-pulse')];
  expect(bars.map((b) => b.style.width)).toEqual(['85%', '60%', '72%']);
});

test('SkeletonLines wraps its bars in an aria-hidden container', () => {
  const { container } = render(<SkeletonLines />);
  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
});

test('SkeletonBlock renders a single pulsing drawer-tone rectangle, sized by the caller', () => {
  const { container } = render(<SkeletonBlock className="aspect-video rounded-lg" />);
  const block = container.firstChild;
  expect(block).toHaveClass('bg-drawer', 'skeleton-pulse', 'aspect-video', 'rounded-lg');
  expect(block).toHaveAttribute('aria-hidden', 'true');
});
