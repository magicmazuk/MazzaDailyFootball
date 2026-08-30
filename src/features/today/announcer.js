// The announcer (spec §13.47): the classified check, aloud, on the
// browser's own speech engine — £0, no key, no network, on-device. No
// SSML and no expressive voice: short utterances and punctuation ARE the
// cadence, because the form is monotone by design. A score of nought is
// SPOKEN as "nil" — the radio word; print keeps the numeral.
const SMALL = ['nil', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export const announcerSupported = () =>
  typeof globalThis.speechSynthesis !== 'undefined' && globalThis.speechSynthesis != null;

const spokenScore = n => SMALL[n] ?? String(n);

export const resultLine = f =>
  `${f.home.name}, ${spokenScore(f.home.score)}. ${f.away.name}, ${spokenScore(f.away.score)}.`;

// One generation token per speakCard: stopSpeaking bumps it, and any
// utterance chain from an older generation goes quiet at its next link —
// the engine's cancel() kills the current utterance, the token kills the
// queue (cancel alone would let onend chains keep enqueueing).
let generation = 0;

const preferredVoice = () => {
  const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
  return voices.find(v => v.lang === 'en-GB') ?? null;
};

function utter(text, gen, onEnd) {
  if (gen !== generation) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = preferredVoice();
  if (voice) u.voice = voice;
  u.rate = 0.95;
  u.onend = () => { if (gen === generation) onEnd?.(); };
  globalThis.speechSynthesis.speak(u);
}

// Read the card desk by desk: the desk's name, then each result. onDesk
// fires with the desk's index BEFORE its lines (the visual reveal lands
// as the voice begins it); onDone fires after the last line.
export function speakCard(desks, { onDesk, onDone } = {}) {
  if (!announcerSupported()) { onDone?.(); return; }
  generation += 1;
  const gen = generation;
  const lines = desks.flatMap((desk, i) => [
    { text: `${desk.comp.shortName}.`, desk: i },
    ...desk.fixtures.map(f => ({ text: resultLine(f), desk: null })),
  ]);
  const next = at => {
    if (gen !== generation) return;
    if (at >= lines.length) { onDone?.(); return; }
    const line = lines[at];
    if (line.desk != null) onDesk?.(line.desk);
    if (gen !== generation) return; // onDesk may have stopped us
    utter(line.text, gen, () => next(at + 1));
  };
  next(0);
}

export function stopSpeaking() {
  generation += 1;
  globalThis.speechSynthesis?.cancel?.();
}
