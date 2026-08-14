import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App.jsx';

test('renders the three tabs', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByText('Today', { selector: 'a' })).toBeInTheDocument();
  expect(screen.getByText('Competitions', { selector: 'a' })).toBeInTheDocument();
  expect(screen.getByText('Clubs', { selector: 'a' })).toBeInTheDocument();
});
