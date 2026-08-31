// The announcer (spec §13.47): the classified check, aloud, on the
// browser's own speech engine — £0, no key, no network, on-device. No
// SSML and no expressive voice: short utterances and punctuation ARE the
// cadence, because the form is monotone by design. A score of nought is
// SPOKEN as "nil" — the radio word; print keeps the numeral.
const SMALL = ['nil', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export const announcerSupported = () =>
  typeof globalThis.speechSynthesis !== 'undefined' && globalThis.speechSynthesis != null;

const spokenScore = n => SMALL[n] ?? String(n);

// The pronunciation desk (user's ear, 2026-08-31): the engine read
// "St Mirren" as "Street Mirren". Spoken names get their radio forms;
// print never changes. More idiosyncrasies join this map as ears find them.
const spokenName = name => String(name).replace(/(^|\s)St\.?(?=\s)/g, '$1Saint');

export const resultLine = f =>
  `${spokenName(f.home.name)}, ${spokenScore(f.home.score)}. `
  + `${spokenName(f.away.name)}, ${spokenScore(f.away.score)}.`;

// One generation token per speakCard: stopSpeaking bumps it, and any
// utterance chain from an older generation goes quiet at its next link —
// the engine's cancel() kills the current utterance, the token kills the
// queue (cancel alone would let onend chains keep enqueueing).
let generation = 0;

const preferredVoice = () => {
  const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
  return voices.find(v => v.lang === 'en-GB') ?? null;
};

function utter(text, gen, onStart, onEnd) {
  if (gen !== generation) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = preferredVoice();
  if (voice) u.voice = voice;
  u.rate = 0.9; // slowed with the visual re-meter (user's ear)
  // The needle drop (user's ear, 2026-08-30): the engine has SPIN-UP
  // latency on first play (worst on iOS) - the visual must land when the
  // voice actually SOUNDS, not when we enqueue. onstart is that moment;
  // the started flag makes the onend fallback idempotent on engines that
  // skip onstart.
  let started = false;
  u.onstart = () => {
    if (gen !== generation || started) return;
    started = true;
    onStart?.();
  };
  u.onend = () => {
    if (gen !== generation) return;
    if (!started) { started = true; onStart?.(); }
    onEnd?.();
  };
  globalThis.speechSynthesis.speak(u);
}

// Read the card desk by desk: the desk's name, then each result. onDesk
// fires with the desk's index BEFORE its lines (the visual reveal lands
// as the voice begins it); onDone fires after the last line.
export function speakCard(desks, { onDesk, onLine, onDone } = {}) {
  if (!announcerSupported()) { onDone?.(); return; }
  generation += 1;
  const gen = generation;
  const lines = desks.flatMap((desk, i) => [
    { text: `${desk.comp.shortName}.`, desk: i, row: null },
    ...desk.fixtures.map((f, r) => ({ text: resultLine(f), desk: i, row: r })),
  ]);
  // Warm the voice list - iOS returns [] until voiceschanged; asking now
  // primes it so the first REAL utterance gets the en-GB voice.
  globalThis.speechSynthesis.getVoices?.();
  const next = at => {
    if (gen !== generation) return;
    if (at >= lines.length) { onDone?.(); return; }
    const line = lines[at];
    utter(line.text, gen,
      () => (line.row == null ? onDesk?.(line.desk) : onLine?.(line.desk, line.row)),
      () => next(at + 1));
  };
  next(0);
}

export function stopSpeaking() {
  generation += 1;
  globalThis.speechSynthesis?.cancel?.();
}
