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

// --- pre-season guard (backlog, spec §13.18.4) ---

test('every row on 0 played renders the pre-season one-liner instead of an alphabetical 0-point table', () => {
  const preSeasonRows = rows.map(r => ({ ...r, played: 0, points: 0 }));
  render(<MemoryRouter>
    <MiniTable comp={byId('sco.1')} rows={preSeasonRows} followedIds={new Set()} />
  </MemoryRouter>);
  expect(screen.getByText("The season hasn't kicked off.")).toBeInTheDocument();
  expect(screen.queryByText('Team1')).not.toBeInTheDocument();
  // The header/link stays intact — still browsable to the full table.
  expect(screen.getByRole('link')).toHaveAttribute('href', '/competition/sco.1');
});

test('any row with played > 0 renders the normal table, not the pre-season line', () => {
  const mixedRows = rows.map((r, i) => ({ ...r, played: i === 0 ? 1 : 0 }));
  render(<MemoryRouter>
    <MiniTable comp={byId('sco.1')} rows={mixedRows} followedIds={new Set()} />
  </MemoryRouter>);
  expect(screen.queryByText("The season hasn't kicked off.")).not.toBeInTheDocument();
  expect(screen.getByText('Team1')).toBeInTheDocument();
});
