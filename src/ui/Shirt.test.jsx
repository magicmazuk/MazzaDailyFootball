// The visual squad experiment (squad-visual branch, Aug 2026): a hand-drawn
// jersey icon carrying the club colour, with the shirt number on the chest.
// contrastOn is the tiny YIQ luminance helper that decides whether the
// number reads in ink or white against that fill.
import { render, screen } from '@testing-library/react';
import Shirt, { contrastOn } from './Shirt.jsx';

test('contrastOn: a dark club colour (Celtic green) takes a white number, a light one (amber) takes ink', () => {
  expect(contrastOn('009921')).toBe('white');
  expect(contrastOn('F7AA25')).toBe('ink');
});

test('the shirt number renders centred on the chest', () => {
  render(<Shirt colour="009921" number="9" />);
  expect(screen.getByText('9')).toBeInTheDocument();
});

test('a null/undefined colour falls back to the drawer token fill, not a crash', () => {
  const { container } = render(<Shirt colour={null} number="9" />);
  expect(container.querySelector('[data-testid="shirt-shape"]')).toHaveAttribute('fill', '#F4F0E7');

  const { container: c2 } = render(<Shirt number="9" />);
  expect(c2.querySelector('[data-testid="shirt-shape"]')).toHaveAttribute('fill', '#F4F0E7');
});

test('an empty-string colour falls back exactly like null/undefined — fill AND the number\'s own contrast colour', () => {
  // Regression: an earlier version guarded the fill with `colour ? … :` but
  // the contrast calc separately with `colour ?? …` — '' is falsy but not
  // nullish, so it slipped past the second guard into contrastOn('') on its
  // own, which parsed to NaN and silently defaulted to white text on the
  // pale fallback fill. Both must resolve through the same fallback now.
  const { container } = render(<Shirt colour="" number="9" />);
  expect(container.querySelector('[data-testid="shirt-shape"]')).toHaveAttribute('fill', '#F4F0E7');
  expect(container.querySelector('text')).toHaveAttribute('fill', 'currentColor'); // ink, not white
});

test('the shirt shape fill is the club colour, keyed for callers to assert on', () => {
  const { container } = render(<Shirt colour="A11B1B" number="10" />);
  expect(container.querySelector('[data-testid="shirt-shape"]')).toHaveAttribute('fill', '#A11B1B');
});

test('a null number renders an em dash on the chest instead', () => {
  render(<Shirt colour="009921" number={null} />);
  expect(screen.getByText('—')).toBeInTheDocument();
});

test('size defaults to 26 and is overridable via the size prop', () => {
  const { container } = render(<Shirt colour="009921" number="9" />);
  const svg = container.querySelector('[data-testid="shirt"]');
  expect(svg).toHaveAttribute('width', '26');
  expect(svg).toHaveAttribute('height', '26');

  const { container: c2 } = render(<Shirt colour="009921" number="9" size={40} />);
  const svg2 = c2.querySelector('[data-testid="shirt"]');
  expect(svg2).toHaveAttribute('width', '40');
  expect(svg2).toHaveAttribute('height', '40');
});
