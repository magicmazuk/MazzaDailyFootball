import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import VideoCard from './VideoCard.jsx';

const videos = [
  { videoId: 'abc123', title: 'Kilmarnock 2-1 Celtic highlights' },
  { videoId: 'def456', title: 'Full match replay' },
];

test('renders nothing when the video list is empty', () => {
  const { container } = render(<VideoCard videos={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('renders a 16:9 iframe embed of the first video, with its title', () => {
  const { container } = render(<VideoCard videos={videos} />);
  const iframe = container.querySelector('iframe');
  expect(iframe.src).toBe('https://www.youtube-nocookie.com/embed/abc123');
  expect(iframe.title).toBe('Kilmarnock 2-1 Celtic highlights');
  expect(iframe).toHaveAttribute('allowFullScreen');
  expect(screen.getByText('Kilmarnock 2-1 Celtic highlights')).toBeInTheDocument();
});

test('dismissing the current video advances to the next one', async () => {
  const user = userEvent.setup();
  const { container } = render(<VideoCard videos={videos} />);

  await user.click(screen.getByLabelText('Dismiss video'));

  const iframe = container.querySelector('iframe');
  expect(iframe.src).toBe('https://www.youtube-nocookie.com/embed/def456');
  expect(screen.getByText('Full match replay')).toBeInTheDocument();
});

test('dismissing past the last video removes the card entirely', async () => {
  const user = userEvent.setup();
  const { container } = render(<VideoCard videos={videos} />);

  await user.click(screen.getByLabelText('Dismiss video'));
  await user.click(screen.getByLabelText('Dismiss video'));

  expect(container).toBeEmptyDOMElement();
});
