import { render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

vi.mock('../../data/queries.js', () => ({ useNews: vi.fn() }));

import Papers from './Papers.jsx';
import { useNews } from '../../data/queries.js';

const item = (id, overrides = {}) => ({
  id, title: `Story ${id}`, description: `Standfirst for story ${id}.`,
  link: `https://www.bbc.co.uk/sport/${id}`, publishedAt: '2026-08-13T09:00:00Z',
  thumbnail: null, ...overrides,
});

const fiveItems = Array.from({ length: 5 }, (_, i) => item(`c${i + 1}`));

function stub({ celtic, football }) {
  useNews.mockImplementation(feed => (feed === 'celtic' ? celtic : football));
}

const loading = { isLoading: true, data: undefined };
const empty = { isLoading: false, data: { items: [] } };

test('renders the section label once and both sub-labels', () => {
  stub({ celtic: empty, football: empty });
  render(<Papers />);
  expect(screen.getByText('The papers')).toBeInTheDocument();
  expect(screen.getByText('Celtic')).toBeInTheDocument();
  expect(screen.getByText('British football')).toBeInTheDocument();
});

test('top story renders headline as an external new-tab link, standfirst, and the BBC Sport meta line', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-13T12:00:00Z')); // 3h after the fixture publishedAt above
  try {
    stub({ celtic: { isLoading: false, data: { items: [item('c1')] } }, football: empty });
    render(<Papers />);
    const link = screen.getByRole('link', { name: 'Story c1' });
    expect(link).toHaveAttribute('href', 'https://www.bbc.co.uk/sport/c1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Standfirst for story c1.')).toBeInTheDocument();
    expect(screen.getByText('BBC Sport · 3h ago')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('thumbnail renders when present and is absent cleanly when not', () => {
  stub({
    celtic: { isLoading: false, data: { items: [item('c1', { thumbnail: 'https://ichef.bbci.co.uk/img.jpg' })] } },
    football: { isLoading: false, data: { items: [item('f1', { thumbnail: null })] } },
  });
  const { container } = render(<Papers />);
  // Decorative thumbnails carry alt="" (no headline duplication for screen
  // readers), which the accessibility tree exposes as role "presentation"
  // rather than "img" — query the DOM directly rather than by role here.
  const images = container.querySelectorAll('img');
  expect(images).toHaveLength(1);
  expect(images[0]).toHaveAttribute('src', 'https://ichef.bbci.co.uk/img.jpg');
});

test('hidden items are not in the DOM before reveal; "+ n more" reveals them and flips to "− fewer"', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  stub({ celtic: { isLoading: false, data: { items: fiveItems } }, football: empty });
  render(<Papers />);

  expect(screen.queryByText('Story c2')).not.toBeInTheDocument();
  expect(screen.queryByText('Story c5')).not.toBeInTheDocument();
  const button = screen.getByRole('button', { name: '+ 4 more' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  const controlsId = button.getAttribute('aria-controls');
  expect(controlsId).toBeTruthy();

  await user.click(button);

  expect(screen.getByText('Story c2')).toBeInTheDocument();
  expect(screen.getByText('Story c3')).toBeInTheDocument();
  expect(screen.getByText('Story c4')).toBeInTheDocument();
  expect(screen.getByText('Story c5')).toBeInTheDocument();
  // The top story (c1) stays put, not duplicated among the compact rows.
  expect(screen.getAllByText('Story c1')).toHaveLength(1);
  const fewerButton = screen.getByRole('button', { name: '− fewer' });
  expect(fewerButton).toHaveAttribute('aria-expanded', 'true');
  expect(fewerButton).toHaveAttribute('aria-controls', controlsId);
  // The revealed rows container is exactly what aria-controls names.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.getElementById(controlsId)).toContainElement(screen.getByText('Story c2'));

  await user.click(fewerButton);
  expect(screen.queryByText('Story c2')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '+ 4 more' })).toHaveAttribute('aria-expanded', 'false');
});

test('the two blocks use distinct aria-controls ids for their reveal buttons', () => {
  stub({
    celtic: { isLoading: false, data: { items: fiveItems } },
    football: { isLoading: false, data: { items: fiveItems.map(it => ({ ...it, id: `f-${it.id}` })) } },
  });
  render(<Papers />);
  const [celticMore, footballMore] = screen.getAllByRole('button', { name: '+ 4 more' });
  expect(celticMore.getAttribute('aria-controls'))
    .not.toBe(footballMore.getAttribute('aria-controls'));
});

test('loading state renders a one-liner per block, independently', () => {
  stub({ celtic: loading, football: { isLoading: false, data: { items: [item('f1')] } } });
  render(<Papers />);
  expect(screen.getByText('Fetching the papers…')).toBeInTheDocument();
  expect(screen.getByText('Story f1')).toBeInTheDocument();
});

test('error/empty state renders the degraded one-liner per block', () => {
  stub({ celtic: empty, football: { isLoading: false, data: undefined } });
  render(<Papers />);
  const lines = screen.getAllByText("The papers haven't arrived.");
  expect(lines).toHaveLength(2);
});

test('a story with no usable timestamp shows the meta line as plain "BBC Sport", no dangling separator', () => {
  stub({
    celtic: { isLoading: false, data: { items: [item('c1', { publishedAt: null })] } },
    football: empty,
  });
  render(<Papers />);
  expect(screen.getByText('BBC Sport')).toBeInTheDocument();
  expect(screen.queryByText(/BBC Sport ·/)).not.toBeInTheDocument();
});

test('each block groups its own content under its own sub-label', () => {
  stub({
    celtic: { isLoading: false, data: { items: [item('c1', { title: 'Celtic story' })] } },
    football: { isLoading: false, data: { items: [item('f1', { title: 'Football story' })] } },
  });
  render(<Papers />);
  const celticLabel = screen.getByText('Celtic');
  const celticBlock = celticLabel.parentElement;
  expect(within(celticBlock).getByText('Celtic story')).toBeInTheDocument();
  expect(within(celticBlock).queryByText('Football story')).not.toBeInTheDocument();
});
