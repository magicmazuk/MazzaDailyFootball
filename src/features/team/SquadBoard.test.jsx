// The team sheet (squad-visual branch, Aug 2026, task 3): SquadBoard is
// presentational — TeamScreen resolves starters/rest and hands down plain
// arrays, tested here directly rather than through the whole screen.
import { render, screen, within } from '@testing-library/react';
import SquadBoard, { formation } from './SquadBoard.jsx';

const p = (id, name, shirt, position) => ({ id, name, shirt, position });

// An 11-player XI shaped like a 4-3-3, plus a small bench so rail ordering
// has something to prove — a null-shirt bench player exercises the
// sorts-last-when-numberless path.
const XI = [
  p('gk1', 'Artur Sinisalo', '1', 'Goalkeeper'),
  p('d1', 'Anthony Ralston', '56', 'Defender'),
  p('d2', 'Cameron Carter-Vickers', '20', 'D'),
  p('d3', 'Auston Trusty', '6', 'Defender'),
  p('d4', 'Kieran Tierney', '63', 'D'),
  p('m1', 'Callum McGregor', '42', 'Midfielder'),
  p('m2', 'Reo Hatate', '41', 'M'),
  p('m3', 'Paulo Bernardo', '14', 'Midfielder'),
  p('f1', 'Jota Silva', '7', 'Forward'),
  p('f2', 'Kasper Høgh', '9', 'F'),
  p('f3', 'Marco Tounekti', '17', 'Forward'),
];
const BENCH = [
  p('b1', 'Ross Doohan', '31', 'Goalkeeper'),
  p('b2', 'Greg Taylor', '3', 'Defender'),
  p('b3', 'Daizen Maeda', '19', 'Forward'),
  p('b4', 'Odin Reserve', null, 'Midfielder'),
];
const FULL_SQUAD = [...XI, ...BENCH];

test('with starters: the pitch buckets each row correctly and captions the formation', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);

  expect(screen.getByText('Last match · 4-3-3 v Kilmarnock')).toBeInTheDocument();

  expect(within(screen.getByTestId('pitch-row-gk')).getAllByRole('button').map(b => b.getAttribute('aria-label')))
    .toEqual(['Artur Sinisalo']);
  expect(within(screen.getByTestId('pitch-row-def')).getAllByRole('button').map(b => b.getAttribute('aria-label')))
    .toEqual(['Anthony Ralston', 'Cameron Carter-Vickers', 'Auston Trusty', 'Kieran Tierney']);
  expect(within(screen.getByTestId('pitch-row-mid')).getAllByRole('button').map(b => b.getAttribute('aria-label')))
    .toEqual(['Callum McGregor', 'Reo Hatate', 'Paulo Bernardo']);
  expect(within(screen.getByTestId('pitch-row-fwd')).getAllByRole('button').map(b => b.getAttribute('aria-label')))
    .toEqual(['Jota Silva', 'Kasper Høgh', 'Marco Tounekti']);
});

test('the rail excludes every starter and lists the rest in ascending shirt-number order, numberless last', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);

  const rail = document.querySelector('.rail-scroll');
  const names = within(rail).getAllByRole('button').map(b => b.getAttribute('aria-label'));
  expect(names).toEqual(['Greg Taylor', 'Daizen Maeda', 'Ross Doohan', 'Odin Reserve']);
  for (const starter of XI) expect(names).not.toContain(starter.name);
});

test('the rail label reads "The bench & the rest" once an XI is known', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);
  expect(screen.getByText('The bench & the rest')).toBeInTheDocument();
});

test('without a lineup: the bands fallback shows the whole squad, no formation caption, no separate bench rail', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={null} teamColour="009921"
    opponentShortName={null} onOpenPlayer={() => {}} />);

  expect(screen.queryByText(/Last match/)).not.toBeInTheDocument();
  // Nobody is excluded from the bands above, so a second "rest of the
  // squad" rail underneath would just repeat every name — it's suppressed
  // rather than shown twice (see the code comment in SquadBoard.jsx).
  expect(screen.queryByText('The bench & the rest')).not.toBeInTheDocument();
  expect(document.querySelector('.rail-scroll')).not.toBeInTheDocument();

  const bandNames = ['squad-band-gk', 'squad-band-def', 'squad-band-mid', 'squad-band-fwd']
    .flatMap(id => within(screen.getByTestId(id)).getAllByRole('button').map(b => b.getAttribute('aria-label')));
  expect(bandNames.sort()).toEqual(FULL_SQUAD.map(pl => pl.name).sort());
});

test('an undefined starters prop (still loading) also falls back to bands, not a crash', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={undefined} teamColour="009921"
    opponentShortName={null} onOpenPlayer={() => {}} />);
  expect(screen.getByTestId('squad-band-gk')).toBeInTheDocument();
});

test('an unrecognised position falls into a trailing Squad band rather than being dropped', () => {
  const mystery = p('x1', 'Mystery Player', '99', null);
  render(<SquadBoard players={[...FULL_SQUAD, mystery]} starters={null} teamColour="009921"
    opponentShortName={null} onOpenPlayer={() => {}} />);
  expect(within(screen.getByTestId('squad-band-squad')).getByRole('button', { name: 'Mystery Player' }))
    .toBeInTheDocument();
});

test('every shirt across pitch, rail and bands is a button carrying the player name as its aria-label', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);
  const buttons = screen.getAllByRole('button');
  expect(buttons.length).toBeGreaterThan(0);
  const knownNames = new Set(FULL_SQUAD.map(pl => pl.name));
  for (const b of buttons) expect(knownNames.has(b.getAttribute('aria-label'))).toBe(true);
});

test('tapping a shirt calls onOpenPlayer with that player\'s id', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  const onOpenPlayer = (await import('vitest')).vi.fn();
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={onOpenPlayer} />);
  await user.click(screen.getByRole('button', { name: 'Kasper Høgh' }));
  expect(onOpenPlayer).toHaveBeenCalledWith('f2');
});

test('no players at all renders nothing', () => {
  const { container } = render(<SquadBoard players={[]} starters={null} teamColour={null}
    opponentShortName={null} onOpenPlayer={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

// --- formation(), the pure D-M-F caption helper ---

test('formation: counts each outfield bucket, GK excluded, defence-midfield-attack order', () => {
  expect(formation(XI)).toBe('4-3-3');
});

test('formation: no starters is 0-0-0, not a crash', () => {
  expect(formation([])).toBe('0-0-0');
  expect(formation(undefined)).toBe('0-0-0');
});
