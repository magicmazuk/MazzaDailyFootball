// Motion (spec §13.21): the page's per-country sections rise in on mount,
// delay class computed from the section's stable array position
// (COMPETITION_GROUPS is a fixed ['Scotland', 'England', 'Europe'] list —
// no runtime reordering), capped at rise-in-5 same as every other screen.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';
import { usePrefs } from '../../store/prefs.js';
import { COMPETITIONS } from '../../domain/competitions.js';
import CompetitionsScreen from './CompetitionsScreen.jsx';

beforeEach(() => {
  usePrefs.setState({ hiddenComps: [] });
});

test('renders a heading per country group with its competitions listed underneath', () => {
  render(<MemoryRouter><CompetitionsScreen /></MemoryRouter>);
  expect(screen.getByText('Scotland')).toBeInTheDocument();
  expect(screen.getByText('England')).toBeInTheDocument();
  expect(screen.getByText('Europe')).toBeInTheDocument();
});

test('a hidden competition is omitted, and a country with nothing left shown drops its whole section', () => {
  const european = COMPETITIONS.filter(c => c.country === 'Europe').map(c => c.id);
  usePrefs.setState({ hiddenComps: european });
  render(<MemoryRouter><CompetitionsScreen /></MemoryRouter>);
  expect(screen.queryByText('Europe')).not.toBeInTheDocument();
});

test('each country section carries .rise-in with a delay class matching its position, in DOM order', () => {
  render(<MemoryRouter><CompetitionsScreen /></MemoryRouter>);
  const scotland = screen.getByText('Scotland').closest('section');
  const england = screen.getByText('England').closest('section');
  const europe = screen.getByText('Europe').closest('section');

  expect(scotland).toHaveClass('rise-in', 'rise-in-1');
  expect(england).toHaveClass('rise-in', 'rise-in-2');
  expect(europe).toHaveClass('rise-in', 'rise-in-3');

  // eslint-disable-next-line no-bitwise
  expect(scotland.compareDocumentPosition(england) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // eslint-disable-next-line no-bitwise
  expect(england.compareDocumentPosition(europe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
