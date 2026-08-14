import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TodayView from './TodayView.jsx';

const mockFixture = (tv = []) => ({
  id: 'f1',
  compId: 'eng.1',
  kickoff: '2026-08-21T19:00:00Z',
  status: 'scheduled',
  tv,
  home: { teamId: '1', name: 'Home', crestUrl: null, monogram: 'HOM', score: null },
  away: { teamId: '2', name: 'Away', crestUrl: null, monogram: 'AWY', score: null },
});

test('renders On TV section with televised fixture', () => {
  const partition = { yours: [], live: [], later: [], earlier: [], yesterday: [] };
  const followedIds = new Set();
  const onTv = [mockFixture(['Sky Sports'])];

  render(
    <BrowserRouter>
      <TodayView
        partition={partition}
        followedIds={followedIds}
        date={new Date('2026-08-21T00:00:00Z')}
        onTv={onTv}
      />
    </BrowserRouter>
  );

  expect(screen.getByText('On TV')).toBeInTheDocument();
  expect(screen.getByText('Sky')).toBeInTheDocument();
});
