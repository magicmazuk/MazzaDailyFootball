import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Crest from './Crest.jsx';
import StatusWord from './StatusWord.jsx';
import FixtureRow from './FixtureRow.jsx';

const side = (over = {}) => ({
  teamId: '10603', name: 'Auchinleck Talbot', shortName: 'Talbot',
  crestUrl: null, monogram: 'AT', colour: null, score: null, ...over,
});

test('Crest renders an img when a crest exists', () => {
  render(<Crest side={side({ crestUrl: 'x.png', name: 'Celtic' })} />);
  expect(screen.getByRole('img', { name: 'Celtic' })).toHaveAttribute('src', 'x.png');
});

test('Crest falls back to the monogram disc when crestUrl is null', () => {
  render(<Crest side={side()} />);
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('AT')).toBeInTheDocument();
});

const fixture = (status, over = {}) => ({
  id: 'e1', compId: 'sco.1', kickoff: '2026-08-22T14:00:00Z', status,
  minute: null, round: null, venue: null,
  home: side({ teamId: '256', name: 'Celtic', crestUrl: 'c.png' }),
  away: side({ teamId: '267', name: 'St Johnstone' }),
  ...over,
});

test('StatusWord: scheduled shows kickoff, live shows the minute, postponed shows P–P', () => {
  const { rerender } = render(<StatusWord fixture={fixture('scheduled')} />);
  expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  rerender(<StatusWord fixture={fixture('live', { minute: "63'" })} />);
  expect(screen.getByText("63'")).toBeInTheDocument();
  rerender(<StatusWord fixture={fixture('postponed')} />);
  expect(screen.getByText('P–P')).toBeInTheDocument();
  rerender(<StatusWord fixture={fixture('ft')} />);
  expect(screen.getByText('FT')).toBeInTheDocument();
});

test('FixtureRow links to the match and stars a followed side', () => {
  render(
    <MemoryRouter>
      <FixtureRow fixture={fixture('ft', {
        home: side({ teamId: '256', name: 'Celtic', crestUrl: 'c.png', score: 2 }),
        away: side({ teamId: '267', name: 'St Johnstone', score: 0 }),
      })} followedIds={new Set(['256'])} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link')).toHaveAttribute('href', '/match/sco.1/e1');
  expect(screen.getByText('★')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
});
