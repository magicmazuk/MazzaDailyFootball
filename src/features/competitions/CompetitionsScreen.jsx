import { Link } from 'react-router-dom';
import { COMPETITION_GROUPS } from '../../domain/competitions.js';
import { usePrefs } from '../../store/prefs.js';
import SectionLabel from '../../ui/SectionLabel.jsx';

export default function CompetitionsScreen() {
  const hidden = usePrefs(s => s.hiddenComps);
  return (
    <main>
      <h1 className="text-[27px] mb-8">Competitions</h1>
      {COMPETITION_GROUPS.map(([country, comps]) => {
        const visible = comps.filter(c => !hidden.includes(c.id));
        if (!visible.length) return null;
        return (
          <section key={country} className="mt-8 first:mt-0">
            <SectionLabel muted>{country}</SectionLabel>
            {visible.map(c => (
              <Link key={c.id} to={`/competition/${c.id}`}
                className="flex items-baseline justify-between py-3.5 border-b border-rule/70">
                <span className="text-[16px]">{c.name}</span>
                <span className="font-sans text-[10px] uppercase tracking-[.14em] text-muted">
                  {c.type}
                </span>
              </Link>
            ))}
          </section>
        );
      })}
    </main>
  );
}
