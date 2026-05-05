import { useCallback, useEffect, useState } from 'react'
import { format, startOfDay, subDays } from 'date-fns'
import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import MobileHeader from './components/MobileHeader'
import SidebarNav from './components/SidebarNav'
import Dashboard from './pages/Dashboard'
import Problems from './pages/Problems'
import TodaysRevision from './pages/TodaysRevision'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import { checkAndFireReminders } from './hooks/useNotifications'
import { getTodaysDueRevisions } from './utils/revisionUtils'
import { getProblems } from './utils/storage'

const toDayKey = (dateValue) => format(startOfDay(new Date(dateValue)), 'yyyy-MM-dd')

const calculateCurrentStreak = (problems) => {
  const activeDays = new Set()

  problems.forEach((problem) => {
    if (problem?.solvedDate) {
      activeDays.add(toDayKey(problem.solvedDate))
    }

    ;(problem?.revisions ?? []).forEach((revision) => {
      if (revision?.completedDate) {
        activeDays.add(toDayKey(revision.completedDate))
      }
    })
  })

  let streak = 0
  let cursor = startOfDay(new Date())

  while (activeDays.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1
    cursor = subDays(cursor, 1)
  }

  return streak
}

function App() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [dueCount, setDueCount] = useState(0)
  const [streak, setStreak] = useState(0)

  const recalculateMobileStats = useCallback(() => {
    const latestProblems = getProblems()
    setDueCount(getTodaysDueRevisions(latestProblems).length)
    setStreak(calculateCurrentStreak(latestProblems))
  }, [])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    checkAndFireReminders()
    const intervalId = setInterval(checkAndFireReminders, 60000)

    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    recalculateMobileStats()
  }, [recalculateMobileStats])

  useEffect(() => {
    const handleUpdate = () => {
      recalculateMobileStats()
    }

    window.addEventListener('trackerDataUpdated', handleUpdate)
    return () => window.removeEventListener('trackerDataUpdated', handleUpdate)
  }, [recalculateMobileStats])

  return (
    <div className="bg-[#0d1117] text-[#e6edf3]" style={{ display: 'flex', height: '100vh' }}>
      {isMobile ? <MobileHeader streak={streak} /> : null}
      {!isMobile ? (
        <SidebarNav isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((prev) => !prev)} />
      ) : null}

      <main
        className="p-4 md:p-8"
        style={{
          flex: 1,
          marginLeft: 0,
          width: isMobile ? '100vw' : isCollapsed ? 'calc(100vw - 56px)' : 'calc(100vw - 240px)',
          transition: 'width 250ms ease',
          overflowY: 'auto',
          minWidth: 0,
          paddingTop: isMobile ? '52px' : undefined,
          paddingBottom: isMobile ? '52px' : undefined,
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
      {isMobile ? <BottomNav isMobile={isMobile} dueCount={dueCount} /> : null}
    </div>
  )
}

export default App
