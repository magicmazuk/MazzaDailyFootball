// The highlights reel on Today (spec §13.36, H-A): one row per FRESH
// episode — show name, relative-day context line, iPlayer deep link. A
// stale or empty reel renders nothing at all (the notice IS the
// notification; it expires by itself).
import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('../../data/queries.js', () => ({ useHighlights: vi.fn() }));

import HighlightsReel from './HighlightsReel.jsx';
import { useHighlights } from '../../data/queries.js';
import { byId } from '../../domain/competitions.js';

const episode = (over = {}) => ({
  comp: byId('eng.1'), show: 'Match of the Day', pid: 'm0001', date: '2026-08-22',
  firstBroadcast: '2026-08-22T21:30:00+01:00', availableUntil: null,
  synopsis: 'Action from the Premier League.',
  url: 'https://www.bbc.co.uk/iplayer/episode/m0001', ...over,
});

afterEach(() => {
  vi.useRealTimers();
});

// 22:00Z on the 22nd is 23:00 London (BST) — still the broadcast's own
// London day, an hour and a half after the 21:30 first broadcast.
test('a fresh episode renders the show name, Tonight context line and the external deep link', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-22T22:00:00Z'));
  useHighlights.mockReturnValue([episode()]);
  render(<HighlightsReel />);
  expect(screen.getByText('The highlights')).toBeInTheDocument();
  expect(screen.getByText('Match of the Day')).toBeInTheDocument();
  expect(screen.getByText('Tonight · Premier League')).toBeInTheDocument();
  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('href', 'https://www.bbc.co.uk/iplayer/episode/m0001');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  // The right margin's accent caps — the Full-table recipe verbatim.
  const cta = screen.getByText('iPlayer →');
  expect(cta.className).toContain('font-sans text-[10px] uppercase tracking-[.16em] text-accent');
});

test('the morning after, the context line reads Last night', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-23T09:00:00Z'));
  useHighlights.mockReturnValue([episode()]);
  render(<HighlightsReel />);
  expect(screen.getByText('Last night · Premier League')).toBeInTheDocument();
});

test('two London days on but still inside 36h, the line names the weekday', () => {
  vi.useFakeTimers();
  // Broadcast 23:00 London Saturday; now 09:00 London Monday — 34h old,
  // fresh, but neither today nor yesterday.
  vi.setSystemTime(new Date('2026-08-24T08:00:00Z'));
  useHighlights.mockReturnValue([episode({ firstBroadcast: '2026-08-22T23:00:00+01:00' })]);
  render(<HighlightsReel />);
  expect(screen.getByText('Saturday · Premier League')).toBeInTheDocument();
});

test('one row per fresh episode, hairline-separated except the last', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-22T22:30:00Z'));
  useHighlights.mockReturnValue([
    episode(),
    episode({ comp: byId('sco.1'), show: 'Sportscene', pid: 'm0002',
      url: 'https://www.bbc.co.uk/iplayer/episode/m0002' }),
  ]);
  render(<HighlightsReel />);
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(2);
  expect(links[0].className).toContain('border-b border-rule');
  expect(links[0].className).toContain('last:border-b-0');
  expect(screen.getByText('Sportscene')).toBeInTheDocument();
  expect(screen.getByText('Tonight · Premiership')).toBeInTheDocument();
});

test('a stale episode (>36h old) renders nothing at all', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-25T12:00:00Z'));
  useHighlights.mockReturnValue([episode()]);
  const { container } = render(<HighlightsReel />);
  expect(container).toBeEmptyDOMElement();
});

test('no episodes renders nothing at all', () => {
  useHighlights.mockReturnValue([]);
  const { container } = render(<HighlightsReel />);
  expect(container).toBeEmptyDOMElement();
});
