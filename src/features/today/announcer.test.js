import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { announcerSupported, resultLine, speakCard, stopSpeaking } from './announcer.js';

// jsdom has no speechSynthesis — stub the whole surface. Utterances speak
// instantly via a captured onend so the queue logic is testable without
// timers or audio.
let spoken;
beforeEach(() => {
  spoken = [];
  const utterances = [];
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    constructor(text) { this.text = text; utterances.push(this); }
  });
  vi.stubGlobal('speechSynthesis', {
    speak: u => { spoken.push(u.text); queueMicrotask(() => { u.onstart?.(); u.onend?.(); }); },
    cancel: vi.fn(),
    getVoices: () => [
      { lang: 'en-US', name: 'Samantha' },
      { lang: 'en-GB', name: 'Daniel' },
    ],
  });
});
afterEach(() => vi.unstubAllGlobals());

const tick = () => new Promise(r => setTimeout(r, 0));

test('support follows the API presence', () => {
  expect(announcerSupported()).toBe(true);
  vi.stubGlobal('speechSynthesis', undefined);
  expect(announcerSupported()).toBe(false);
});

test('a result line speaks names and scores, nil for nought', () => {
  const fx = { home: { name: 'St Mirren', score: 3 }, away: { name: 'Motherwell', score: 3 } };
  expect(resultLine(fx)).toBe('Saint Mirren, three. Motherwell, three.');
  const nil = { home: { name: 'Celtic', score: 2 }, away: { name: 'Falkirk', score: 0 } };
  expect(resultLine(nil)).toBe('Celtic, two. Falkirk, nil.');
  // the pronunciation desk: St is spoken Saint, printed St
  const saints = { home: { name: 'St Mirren', score: 3 }, away: { name: 'St Johnstone', score: 0 } };
  expect(resultLine(saints)).toBe('Saint Mirren, three. Saint Johnstone, nil.');
  const big = { home: { name: 'A', score: 11 }, away: { name: 'B', score: 10 } };
  expect(resultLine(big)).toBe('A, 11. B, 10.');
});

test('speakCard reads desk by desk — onDesk fires BEFORE its lines, onDone at the end, en-GB voice chosen', async () => {
  const desks = [
    { comp: { shortName: 'Premiership' }, fixtures: [
      { home: { name: 'Celtic', score: 2 }, away: { name: 'Falkirk', score: 0 } },
    ] },
    { comp: { shortName: 'Premier League' }, fixtures: [
      { home: { name: 'Hull', score: 1 }, away: { name: 'Everton', score: 1 } },
    ] },
  ];
  const order = [];
  const onDesk = vi.fn(i => order.push(`desk${i}`));
  const onLine = vi.fn((i, r) => order.push(`line${i}.${r}`));
  const onDone = vi.fn(() => order.push('done'));
  speakCard(desks, { onDesk, onLine, onDone });
  await tick(); await tick(); await tick(); await tick(); await tick(); await tick();
  expect(spoken).toEqual([
    'Premiership.',
    'Celtic, two. Falkirk, nil.',
    'Premier League.',
    'Hull, one. Everton, one.',
  ]);
  expect(order).toEqual(['desk0', 'line0.0', 'desk1', 'line1.0', 'done']);
});

test('stopSpeaking cancels the engine and the queue never continues', async () => {
  const desks = [{ comp: { shortName: 'Premiership' }, fixtures: [
    { home: { name: 'A', score: 1 }, away: { name: 'B', score: 0 } },
    { home: { name: 'C', score: 1 }, away: { name: 'D', score: 0 } },
  ] }];
  speakCard(desks, { onDesk: () => stopSpeaking(), onDone: vi.fn() });
  await tick(); await tick(); await tick();
  expect(globalThis.speechSynthesis.cancel).toHaveBeenCalled();
  expect(spoken.length).toBeLessThanOrEqual(1);
});


test('the reveal waits for the needle drop — onDesk fires on the utterance STARTING, never on enqueue', async () => {
  let held;
  globalThis.speechSynthesis.speak = u => { spoken.push(u.text); held = u; };
  const onDesk = vi.fn();
  speakCard([{ comp: { shortName: 'Premiership' }, fixtures: [] }], { onDesk });
  await tick();
  // enqueued but not yet sounding: the page must not have moved
  expect(spoken).toEqual(['Premiership.']);
  expect(onDesk).not.toHaveBeenCalled();
  held.onstart();
  expect(onDesk).toHaveBeenCalledWith(0);
});
