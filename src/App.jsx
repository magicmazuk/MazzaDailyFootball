import { Routes, Route } from 'react-router-dom';
import AppShell from './ui/AppShell.jsx';
import TodayScreen from './features/today/TodayScreen.jsx';

const Stub = ({ name }) => <p className="text-muted">{name}</p>;

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayScreen />} />
        <Route path="competitions" element={<Stub name="Competitions" />} />
        <Route path="competition/:compId" element={<Stub name="Competition" />} />
        <Route path="clubs" element={<Stub name="Clubs" />} />
        <Route path="team/:compId/:teamId" element={<Stub name="Team" />} />
        <Route path="match/:compId/:eventId" element={<Stub name="Match" />} />
      </Route>
    </Routes>
  );
}
