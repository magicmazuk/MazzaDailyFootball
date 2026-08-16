import { Routes, Route } from 'react-router-dom';
import AppShell from './ui/AppShell.jsx';
import TodayScreen from './features/today/TodayScreen.jsx';
import CalendarScreen from './features/calendar/CalendarScreen.jsx';
import CompetitionsScreen from './features/competitions/CompetitionsScreen.jsx';
import CompetitionScreen from './features/competition/CompetitionScreen.jsx';
import TeamScreen from './features/team/TeamScreen.jsx';
import PlayerScreen from './features/player/PlayerScreen.jsx';
import MatchScreen from './features/match/MatchScreen.jsx';
import ClubsScreen from './features/clubs/ClubsScreen.jsx';
import DrawScreen from './features/draw/DrawScreen.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayScreen />} />
        <Route path="calendar" element={<CalendarScreen />} />
        <Route path="calendar/:teamId" element={<CalendarScreen />} />
        <Route path="competitions" element={<CompetitionsScreen />} />
        <Route path="competition/:compId" element={<CompetitionScreen />} />
        <Route path="clubs" element={<ClubsScreen />} />
        <Route path="team/:compId/:teamId" element={<TeamScreen />} />
        <Route path="player/:compId/:playerId" element={<PlayerScreen />} />
        <Route path="match/:compId/:eventId" element={<MatchScreen />} />
        <Route path="draw/:compId/:round" element={<DrawScreen />} />
        <Route path="draw/:compId/:round/:teamId" element={<DrawScreen />} />
      </Route>
    </Routes>
  );
}
