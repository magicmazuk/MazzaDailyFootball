import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

vi.mock('../../data/queries.js', () => ({ usePlayer: vi.fn() }));

import PlayerSheet from './PlayerSheet.jsx';
import { usePlayer } from '../../data/queries.js';
import { byId } from '../../domain/competitions.js';

const outfieldBio = {
  id: '272624', name: 'Kasper Høgh', position: 'Forward', shirt: '9', age: 25,
  nationality: 'Denmark', heightDisplay: "6' 1\"", birthDate: null, birthPlace: null,
};
const outfieldStats = {
  appearances: 2, starts: 2, minutes: 172, goals: 3, assists: 0,
  shotsOnTarget: 5, shotsOffTarget: 4, totalShots: 13,
  accuratePasses: 23, inaccuratePasses: 15, totalPasses: 38, passPct: 0.605,
  foulsCommitted: 3, yellowCards: 0, redCards: 0, effectiveTackles: 1,
  saves: null, cleanSheets: null, goalsConceded: null, rating: null,
};

const comp = byId('sco.1');

test('a null playerId keeps the sheet closed and off-screen', () => {
  usePlayer.mockReturnValue({ bio: null, stats: null, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId={null} onClose={() => {}} /></MemoryRouter>);
  expect(screen.queryByText('Kasper Høgh')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
});

test('a playerId opens the sheet with name, sys line and three headline numbers', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.getByText('Kasper Høgh')).toBeInTheDocument();
  expect(screen.getByText('№ 9')).toBeInTheDocument();
  expect(screen.getByText(/Forward/)).toBeInTheDocument();
  expect(screen.getByText(/Denmark/)).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument(); // goals
  expect(screen.getByText('172′')).toBeInTheDocument(); // minutes
  expect(screen.getByText('Goals')).toBeInTheDocument();
  expect(screen.getByText('Minutes')).toBeInTheDocument();
});

test('a null rating substitutes appearances as the third headline number', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.queryByText('Rating')).not.toBeInTheDocument();
  expect(screen.getByText('Games')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
});

test('a rated player shows rating as the third headline number', () => {
  usePlayer.mockReturnValue({
    bio: outfieldBio, stats: { ...outfieldStats, rating: 7.4 }, isLoading: false, isError: false,
  });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.getByText('Rating')).toBeInTheDocument();
  expect(screen.getByText('7.4')).toBeInTheDocument();
  expect(screen.queryByText('Games')).not.toBeInTheDocument();
});

test('a keeper shows saves, clean sheets and rating (or games)', () => {
  const keeperBio = { ...outfieldBio, position: 'Goalkeeper' };
  const keeperStats = { ...outfieldStats, goals: null, saves: 11, cleanSheets: 1, rating: null };
  usePlayer.mockReturnValue({ bio: keeperBio, stats: keeperStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  expect(screen.getByText('Saves')).toBeInTheDocument();
  expect(screen.getByText('Clean sheets')).toBeInTheDocument();
  expect(screen.getByText('11')).toBeInTheDocument();
  expect(screen.queryByText('Minutes')).not.toBeInTheDocument();
});

test('the close button calls onClose', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});

test('the backdrop dismiss button closes on tap', async () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const onClose = vi.fn();
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={onClose} /></MemoryRouter>);
  await userEvent.click(screen.getByLabelText('Dismiss'));
  expect(onClose).toHaveBeenCalled();
});

test('"Full profile →" links to the player route', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  render(<MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>);
  const link = screen.getByRole('link', { name: /Full profile/ });
  expect(link).toHaveAttribute('href', '/player/sco.1/272624');
});

test('no portrait/roundel/mark visual anywhere in the sheet', () => {
  usePlayer.mockReturnValue({ bio: outfieldBio, stats: outfieldStats, isLoading: false, isError: false });
  const { container } = render(
    <MemoryRouter><PlayerSheet comp={comp} playerId="272624" onClose={() => {}} /></MemoryRouter>,
  );
  expect(container.querySelectorAll('[class*="mark"], [class*="roundel"], [class*="portrait"], [class*="avatar"]'))
    .toHaveLength(0);
});
