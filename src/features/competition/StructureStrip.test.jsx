import { render, screen } from '@testing-library/react';
import StructureStrip from './StructureStrip.jsx';
import { byId } from '../../domain/competitions.js';

// UEFA_STRUCTURE shared by the three European cups (see competitions.js):
// [{ n: 36, label: 'league phase' }, { n: 8, label: 'straight to last 16' },
//  { n: 16, label: '9th–24th play-off' }, { n: null, label: 'knockout' }]
const ucl = byId('uefa.champions');

test('renders numerals and labels for the UCL structure', () => {
  render(<StructureStrip structure={ucl.structure} />);
  expect(screen.getByText('36')).toBeInTheDocument();
  expect(screen.getByText('league phase')).toBeInTheDocument();
  expect(screen.getByText('8')).toBeInTheDocument();
  expect(screen.getByText('straight to last 16')).toBeInTheDocument();
  expect(screen.getByText('16')).toBeInTheDocument();
  expect(screen.getByText('9th–24th play-off')).toBeInTheDocument();
  expect(screen.getByText('knockout')).toBeInTheDocument();
});

test('null structure renders nothing', () => {
  const { container } = render(<StructureStrip structure={null} />);
  expect(container).toBeEmptyDOMElement();
});

test('empty structure array renders nothing', () => {
  const { container } = render(<StructureStrip structure={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('separator count is nodes minus one', () => {
  render(<StructureStrip structure={ucl.structure} />);
  expect(screen.getAllByText('›')).toHaveLength(ucl.structure.length - 1);
});

test('a node with n: null renders label only, no numeral text for it', () => {
  const structure = [{ n: null, label: 'Straight knockout' }, { n: null, label: 'clubs enter in waves' }];
  render(<StructureStrip structure={structure} />);
  expect(screen.getByText('Straight knockout')).toBeInTheDocument();
  expect(screen.getByText('clubs enter in waves')).toBeInTheDocument();
  expect(screen.getAllByText('›')).toHaveLength(1);
});

// F2 (spec §13.11): a wide strip swipes horizontally instead of wrapping
// — a wrapped separator on its own line was an orphaned '›' on mobile.
test('the strip scrolls horizontally instead of wrapping, and separator count is unchanged', () => {
  const { container } = render(<StructureStrip structure={ucl.structure} />);
  const scroller = container.querySelector('.overflow-x-auto');
  expect(scroller).not.toBeNull();
  expect(scroller.className).toContain('flex-nowrap');
  expect(scroller.className).not.toMatch(/(^|\s)flex-wrap(\s|$)/);
  expect(screen.getAllByText('›')).toHaveLength(ucl.structure.length - 1);
});

test('the bottom hairline lives on a wrapper that does not itself scroll, so the rule stays full-width', () => {
  const { container } = render(<StructureStrip structure={ucl.structure} />);
  const scroller = container.querySelector('.overflow-x-auto');
  const hairline = container.querySelector('.border-b');
  expect(hairline).not.toBeNull();
  expect(hairline).not.toBe(scroller);
  expect(hairline.className).not.toContain('overflow-x-auto');
  expect(hairline.contains(scroller)).toBe(true);
});

test('each node is shrink-0 with the tightened 88px max-width', () => {
  const { container } = render(<StructureStrip structure={ucl.structure} />);
  const nodeBoxes = container.querySelectorAll('.max-w-\\[88px\\]');
  expect(nodeBoxes).toHaveLength(ucl.structure.length);
  for (const box of nodeBoxes) {
    expect(box.className).toContain('shrink-0');
  }
});
