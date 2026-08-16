// The team sheet (squad-visual branch, Aug 2026, task 3): SquadBoard is
// presentational — TeamScreen resolves starters/rest and hands down plain
// arrays, tested here directly rather than through the whole screen.
import { render, screen, within } from '@testing-library/react';
import SquadBoard from './SquadBoard.jsx';

const p = (id, name, shirt, position) => ({ id, name, shirt, position });
// Every shirt's accessible name is "<number> · <name>" (or "— · <name>"
// for no number) — see ShirtUnit in SquadBoard.jsx.
const lbl = pl => `${pl.shirt ?? '—'} · ${pl.name}`;

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

test('with starters: the pitch buckets each row correctly, no numeral formation claim', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);

  // Caption drops the numerals entirely (buckets are nominal squad
  // positions, not this match's actual roles — a "4-3-3"-style claim from
  // that data reads as nonsense for plenty of real clubs).
  expect(screen.getByText('Last match v Kilmarnock')).toBeInTheDocument();
  expect(screen.queryByText(/\d-\d/)).not.toBeInTheDocument();

  expect(within(screen.getByTestId('pitch-row-gk')).getAllByRole('button').map(b => b.getAttribute('aria-label')))
    .toEqual([lbl(p('', 'Artur Sinisalo', '1'))]);
  expect(within(screen.getByTestId('pitch-row-def')).getAllByRole('button').map(b => b.getAttribute('aria-label')))
    .toEqual(['Anthony Ralston', 'Cameron Carter-Vickers', 'Auston Trusty', 'Kieran Tierney']
      .map((name, i) => lbl(p('', name, ['56', '20', '6', '63'][i]))));
  expect(within(screen.getByTestId('pitch-row-mid')).getAllByRole('button').map(b => b.getAttribute('aria-label')))
    .toEqual(['Callum McGregor', 'Reo Hatate', 'Paulo Bernardo']
      .map((name, i) => lbl(p('', name, ['42', '41', '14'][i]))));
  expect(within(screen.getByTestId('pitch-row-fwd')).getAllByRole('button').map(b => b.getAttribute('aria-label')))
    .toEqual(['Jota Silva', 'Kasper Høgh', 'Marco Tounekti']
      .map((name, i) => lbl(p('', name, ['7', '9', '17'][i]))));
});

test('without an opponent name the caption still reads "Last match", no trailing "v"', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName={null} onOpenPlayer={() => {}} />);
  expect(screen.getByText('Last match')).toBeInTheDocument();
});

test('a starter with no recognisable position (synthesised from the lineup, no squad match) still gets its own pitch row rather than being dropped', () => {
  // Mirrors what TeamScreen's matchStarters() hands SquadBoard when a
  // lineup starter's id isn't in the squad list: id/name/shirt from the
  // lineup entry, position: null.
  const unmatched = p('espn-999', 'New Signing', '77', null);
  const xiWithUnmatched = [...XI.slice(0, 10), unmatched]; // 11 starters, one unrecognised
  render(<SquadBoard players={[...FULL_SQUAD, unmatched]} starters={xiWithUnmatched} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);

  expect(within(screen.getByTestId('pitch-row-squad')).getByRole('button', { name: lbl(unmatched) }))
    .toBeInTheDocument();
  // All 11 starters still on the pitch — none silently vanished.
  const pitchRows = screen.getAllByTestId(/^pitch-row-/);
  const onPitch = pitchRows.flatMap(r => within(r).getAllByRole('button'));
  expect(onPitch).toHaveLength(11);
});

test('the rail excludes every starter and lists the rest in ascending shirt-number order, numberless last', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);

  const rail = document.querySelector('.rail-scroll');
  const names = within(rail).getAllByRole('button').map(b => b.getAttribute('aria-label'));
  // BENCH is deliberately not declared in number order — this proves the
  // rail sorts it (3, 19, 31, then the numberless one last).
  const [doohan, taylor, maeda, reserve] = BENCH;
  expect(names).toEqual([taylor, maeda, doohan, reserve].map(lbl));
  for (const starter of XI) expect(names).not.toContain(lbl(starter));
});

test('the rail label reads "The bench & the rest" once an XI is known', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);
  expect(screen.getByText('The bench & the rest')).toBeInTheDocument();
});

test('without a lineup: the bands fallback shows the whole squad, no caption, no separate bench rail', () => {
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
  expect(bandNames.sort()).toEqual(FULL_SQUAD.map(lbl).sort());
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
  expect(within(screen.getByTestId('squad-band-squad')).getByRole('button', { name: lbl(mystery) }))
    .toBeInTheDocument();
});

test('every shirt across pitch, rail and bands is a button carrying "<number> · <name>" as its aria-label', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);
  const buttons = screen.getAllByRole('button');
  expect(buttons.length).toBeGreaterThan(0);
  const knownLabels = new Set(FULL_SQUAD.map(lbl));
  for (const b of buttons) expect(knownLabels.has(b.getAttribute('aria-label'))).toBe(true);
});

test('tapping a shirt calls onOpenPlayer with that player\'s id', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  const onOpenPlayer = (await import('vitest')).vi.fn();
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={onOpenPlayer} />);
  await user.click(screen.getByRole('button', { name: lbl(p('', 'Kasper Høgh', '9')) }));
  expect(onOpenPlayer).toHaveBeenCalledWith('f2');
});

test('no players at all renders nothing', () => {
  const { container } = render(<SquadBoard players={[]} starters={null} teamColour={null}
    opponentShortName={null} onOpenPlayer={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

// --- pitch polish: markings only in pitch mode, spacing tightened around the keeper ---

test('the halfway line and box hints render only in pitch mode, not in the bands fallback', () => {
  const { rerender } = render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);
  expect(screen.getByTestId('pitch-halfway')).toBeInTheDocument();
  expect(screen.getByTestId('pitch-box-top')).toBeInTheDocument();
  expect(screen.getByTestId('pitch-box-bottom')).toBeInTheDocument();

  rerender(<SquadBoard players={FULL_SQUAD} starters={null} teamColour="009921"
    opponentShortName={null} onOpenPlayer={() => {}} />);
  expect(screen.queryByTestId('pitch-halfway')).not.toBeInTheDocument();
  expect(screen.queryByTestId('pitch-box-top')).not.toBeInTheDocument();
  expect(screen.queryByTestId('pitch-box-bottom')).not.toBeInTheDocument();
});

test('pitch rows run GK-bottom to FWD-top, and the keeper sits tight against the back line rather than stranded', () => {
  render(<SquadBoard players={FULL_SQUAD} starters={XI} teamColour="009921"
    opponentShortName="Kilmarnock" onOpenPlayer={() => {}} />);

  const topOf = testId => Number(screen.getByTestId(testId).style.top.replace('%', ''));
  const gk = topOf('pitch-row-gk');
  const def = topOf('pitch-row-def');
  const mid = topOf('pitch-row-mid');
  const fwd = topOf('pitch-row-fwd');

  // top:X% is X% DOWN from the frame's top edge, so bottom-of-pitch (GK)
  // is the largest number, top-of-pitch (FWD) the smallest.
  expect(gk).toBeGreaterThan(def);
  expect(def).toBeGreaterThan(mid);
  expect(mid).toBeGreaterThan(fwd);

  // The GK-to-back-line gap is deliberately tighter than the even spacing
  // between the outfield rows themselves.
  const gkGap = gk - def;
  const outfieldGap = def - mid;
  expect(gkGap).toBeLessThan(outfieldGap);
});
