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

// --- motion (spec §13.21): content landing (a skeleton, or nothing,
// replaced by the iframe) crossfades in rather than hard-cutting. ---

test('the card root crossfades in (.xfade-in) when it renders', () => {
  const { container } = render(<VideoCard videos={videos} />);
  expect(container.querySelector('section')).toHaveClass('xfade-in');
});

test('dismissing the current video advances to the next one', async () => {
  const user = userEvent.setup();
  const { container } = render(<VideoCard videos={videos} />);

  await user.click(screen.getByLabelText('Dismiss video'));

  const iframe = container.querySelector('iframe');
  expect(iframe.src).toBe('https://www.youtube-nocookie.com/embed/def456');
  expect(screen.getByText('Full match replay')).toBeInTheDocument();
});

test('dismissing past the last video removes the card entirely when no exhaustedLine is given (MatchRoom\'s path, byte-identical to before this prop existed)', async () => {
  const user = userEvent.setup();
  const { container } = render(<VideoCard videos={videos} />);

  await user.click(screen.getByLabelText('Dismiss video'));
  await user.click(screen.getByLabelText('Dismiss video'));

  expect(container).toBeEmptyDOMElement();
});

// --- exhaustedLine (review round 2, LOW fix, spec §13.20.3): an optional
// muted one-liner for the fully-dismissed state, so the scout film doesn't
// leave a permanently blank section once every video's gone. Only changes
// behaviour once every video is dismissed — an empty list from the start
// still renders nothing regardless of the prop. ---

test('dismissing past the last video renders the exhaustedLine one-liner when the caller opts in', async () => {
  const user = userEvent.setup();
  render(<VideoCard videos={videos} exhaustedLine="That's the whole reel." />);

  await user.click(screen.getByLabelText('Dismiss video'));
  await user.click(screen.getByLabelText('Dismiss video'));

  expect(screen.getByText("That's the whole reel.")).toBeInTheDocument();
});

test('an empty video list from the start still renders nothing even with exhaustedLine set', () => {
  const { container } = render(<VideoCard videos={[]} exhaustedLine="That's the whole reel." />);
  expect(container).toBeEmptyDOMElement();
});
