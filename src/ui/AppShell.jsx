import { NavLink, Outlet, useLocation } from 'react-router-dom';
import FitbaMark from './FitbaMark.jsx';

const TABS = [
  ['/', 'Today'],
  ['/calendar', 'Calendar'],
  ['/competitions', 'Competitions'],
  ['/clubs', 'Clubs'],
];

export default function AppShell() {
  // The sports desk (spec 13.49) is the one landscape edition - every
  // other page keeps the phone frame the paper was set in.
  const wide = useLocation().pathname === '/desk';
  return (
    <div className={`min-h-screen mx-auto px-5 pt-7 pb-24 ${wide ? 'max-w-[1120px]' : 'max-w-md'}`}>
      {/* The running head (spec §13.27, M-B): the paper's nameplate on
          every screen, one quiet row over a hairline. */}
      <header className="flex items-center pb-2.5 mb-5 border-b border-rule">
        <FitbaMark />
      </header>
      <Outlet />
      {/* z-30: above any page content (team pages lift to z-10 over their
          watermark), below the player sheet's scrim/panel (z-40/z-50). */}
      <nav className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto bg-paper/95 backdrop-blur border-t border-rule flex">
        {TABS.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 py-4 text-center font-sans text-[10px] uppercase tracking-[.18em] ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
