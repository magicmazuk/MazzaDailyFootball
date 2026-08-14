import Crest from '../../ui/Crest.jsx';
import { dayKey } from '../../domain/calendar.js';

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Which crests represent a day (spec §13.5): club mode → opponent;
// general → fixtures with followed clubs first (their own crest), then
// home crests. Max three, remainder as +n.
function dayCrests(fixtures, followedIds, clubId) {
  if (!fixtures?.length) return { crests: [], extra: 0 };
  let sides;
  if (clubId) {
    sides = fixtures.map(f => (f.home.teamId === clubId ? f.away : f.home));
  } else {
    const ranked = [...fixtures].sort((a, b) => {
      const fol = f => (followedIds.has(f.home.teamId) || followedIds.has(f.away.teamId) ? 0 : 1);
      return fol(a) - fol(b);
    });
    sides = ranked.map(f =>
      followedIds.has(f.home.teamId) ? f.home
      : followedIds.has(f.away.teamId) ? f.away
      : f.home);
  }
  return { crests: sides.slice(0, 3), extra: Math.max(0, sides.length - 3) };
}

const label = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function MonthGrid({
  weeks, monthIndex, byDay, followedIds, clubId, selectedKey, onSelectDay, todayKey,
}) {
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-ink pb-1.5 mb-1">
        {DAY_INITIALS.map((d, i) => (
          <span key={i} className="text-center font-sans text-[9px] uppercase tracking-[.18em] text-muted">
            {d}
          </span>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-rule/60">
          {week.map(day => {
            const key = dayKey(day);
            const inMonth = day.getMonth() === monthIndex;
            const { crests, extra } = dayCrests(byDay.get(key), followedIds, clubId);
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <button key={key} type="button" onClick={() => onSelectDay(key)}
                aria-label={label(day)} aria-pressed={isSelected}
                className={`min-h-[52px] py-1 px-0.5 text-left align-top border-r border-rule/40
                  last:border-r-0 ${isSelected ? 'bg-drawer' : ''}`}>
                <span className={`block text-center font-sans text-[10px] tabular-nums mb-1
                  ${isToday ? 'text-accent font-semibold' : inMonth ? 'text-ink' : 'text-muted/50'}`}>
                  {day.getDate()}
                </span>
                <span className="flex justify-center items-center gap-0.5 flex-wrap">
                  {crests.map((s, i) => <Crest key={`${s.teamId}-${i}`} side={s} size={13} />)}
                  {extra > 0 && (
                    <span className="font-sans text-[8px] text-muted">+{extra}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
