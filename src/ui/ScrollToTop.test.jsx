import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import ScrollToTop from './ScrollToTop.jsx';

// A route change (navigate to /b) and an unrelated state update (bump,
// which re-renders the tree but keeps the same pathname) — the two cases
// spec §13.13 cares about: real navigation scrolls, everything else
// (tab switches, drawers, calendar day taps) must not.
function Controls() {
  const navigate = useNavigate();
  const [n, setN] = useState(0);
  return (
    <>
      <button type="button" onClick={() => navigate('/b')}>navigate</button>
      <button type="button" onClick={() => setN(n + 1)}>bump {n}</button>
    </>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

test('scrolls to top when the pathname changes', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(
    <MemoryRouter initialEntries={['/a']}>
      <ScrollToTop />
      <Controls />
    </MemoryRouter>,
  );
  scrollTo.mockClear(); // isolate the navigation from the mount-time call

  await user.click(screen.getByText('navigate'));

  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenCalledWith(0, 0);
});

test('does not scroll again on a re-render with the same pathname', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(
    <MemoryRouter initialEntries={['/a']}>
      <ScrollToTop />
      <Controls />
    </MemoryRouter>,
  );
  scrollTo.mockClear();

  await user.click(screen.getByText(/bump/));

  expect(scrollTo).not.toHaveBeenCalled();
});
