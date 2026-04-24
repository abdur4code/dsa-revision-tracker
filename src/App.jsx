import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import SidebarNav from './components/SidebarNav'
import Dashboard from './pages/Dashboard'
import Problems from './pages/Problems'
import TodaysRevision from './pages/TodaysRevision'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import { checkAndFireReminders } from './hooks/useNotifications'

function App() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    checkAndFireReminders()
    const intervalId = setInterval(checkAndFireReminders, 30 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [])

  return (
    <div className="bg-[#0d1117] text-[#e6edf3]" style={{ display: 'flex', height: '100vh' }}>
      <SidebarNav isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((prev) => !prev)} />

      <main
        className="p-4 md:p-8"
        style={{
          flex: 1,
          marginLeft: 0,
          width: isCollapsed ? 'calc(100vw - 56px)' : 'calc(100vw - 240px)',
          transition: 'width 250ms ease',
          overflowY: 'auto',
          minWidth: 0,
        }}
      >
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
