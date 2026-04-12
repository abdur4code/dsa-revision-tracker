import { Navigate, Route, Routes } from 'react-router-dom'
import SidebarNav from './components/SidebarNav'
import Dashboard from './pages/Dashboard'
import Problems from './pages/Problems'
import TodaysRevisionPage from './pages/TodaysRevisionPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <SidebarNav />

      <main className="p-4 md:ml-[240px] md:p-8">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/problems" element={<Problems />} />
          <Route path="/today" element={<TodaysRevisionPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
