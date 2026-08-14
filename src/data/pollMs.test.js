import { pollMs } from './queries.js';

const at = iso => new Date(iso).getTime();
const f = (status, kickoff) => ({ status, kickoff });

test('any live fixture polls at 30s', () => {
  expect(pollMs([f('ft', '2026-08-13T12:00Z'), f('live', '2026-08-13T14:00Z')],
    at('2026-08-13T15:00Z'))).toBe(30000);
});

test('a kickoff within two hours polls at 60s', () => {
  expect(pollMs([f('scheduled', '2026-08-13T15:00Z')], at('2026-08-13T14:00Z'))).toBe(60000);
});

test('a quiet day does not poll at all', () => {
  expect(pollMs([f('scheduled', '2026-08-13T15:00Z')], at('2026-08-13T09:00Z'))).toBe(false);
  expect(pollMs([f('ft', '2026-08-12T15:00Z')], at('2026-08-13T09:00Z'))).toBe(false);
  expect(pollMs([], at('2026-08-13T09:00Z'))).toBe(false);
  expect(pollMs(undefined, at('2026-08-13T09:00Z'))).toBe(false);
});
