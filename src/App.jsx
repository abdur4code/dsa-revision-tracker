import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import SidebarNav from './components/SidebarNav'
import Dashboard from './pages/Dashboard'
import Problems from './pages/Problems'
import TodaysRevision from './pages/TodaysRevision'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import { checkAndFireReminders } from './hooks/useNotifications'

function App() {
  useEffect(() => {
    checkAndFireReminders()
    const intervalId = setInterval(checkAndFireReminders, 30 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [])

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <SidebarNav />

      <main className="p-4 md:ml-[240px] md:p-8">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/problems" element={<Problems />} />
          <Route path="/today" element={<TodaysRevision />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
