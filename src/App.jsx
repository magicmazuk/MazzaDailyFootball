import { Routes, Route } from 'react-router-dom';
import AppShell from './ui/AppShell.jsx';
import TodayScreen from './features/today/TodayScreen.jsx';
import CompetitionsScreen from './features/competitions/CompetitionsScreen.jsx';
import CompetitionScreen from './features/competition/CompetitionScreen.jsx';
import TeamScreen from './features/team/TeamScreen.jsx';
import MatchScreen from './features/match/MatchScreen.jsx';

const Stub = ({ name }) => <p className="text-muted">{name}</p>;

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayScreen />} />
        <Route path="competitions" element={<CompetitionsScreen />} />
        <Route path="competition/:compId" element={<CompetitionScreen />} />
        <Route path="clubs" element={<Stub name="Clubs" />} />
        <Route path="team/:compId/:teamId" element={<TeamScreen />} />
        <Route path="match/:compId/:eventId" element={<MatchScreen />} />
      </Route>
    </Routes>
  );
}
