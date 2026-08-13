import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  ['/', 'Today'],
  ['/competitions', 'Competitions'],
  ['/clubs', 'Clubs'],
];

export default function AppShell() {
  return (
    <div className="min-h-screen max-w-md mx-auto px-5 pt-7 pb-24">
      <Outlet />
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-paper/95 backdrop-blur border-t border-rule flex">
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
