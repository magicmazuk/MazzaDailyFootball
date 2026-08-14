import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MiniTable from './MiniTable.jsx';
import { byId } from '../../domain/competitions.js';

const row = (position, name) => ({ teamId: name, name, crestUrl: null,
  monogram: name.slice(0, 2).toUpperCase(), position, points: 100 - position, deduction: 0 });
const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, 'Team' + (i + 1)));

test('shows top four and links to the full competition', () => {
  render(<MemoryRouter>
    <MiniTable comp={byId('sco.1')} rows={rows} followedIds={new Set()} />
  </MemoryRouter>);
  expect(screen.getByText('Team1')).toBeInTheDocument();
  expect(screen.getByText('Team4')).toBeInTheDocument();
  expect(screen.queryByText('Team5')).toBeNull();
  expect(screen.getByRole('link')).toHaveAttribute('href', '/competition/sco.1');
});

test('a followed club below 4th is appended after a gap marker', () => {
  render(<MemoryRouter>
    <MiniTable comp={byId('sco.1')} rows={rows} followedIds={new Set(['Team9'])} />
  </MemoryRouter>);
  expect(screen.getByText('Team9')).toBeInTheDocument();
  expect(screen.getByText('⋯')).toBeInTheDocument();
});

test('empty rows render nothing', () => {
  const { container } = render(<MemoryRouter>
    <MiniTable comp={byId('sco.1')} rows={[]} followedIds={new Set()} />
  </MemoryRouter>);
  expect(container.firstChild).toBeNull();
});
