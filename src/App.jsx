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
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

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
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
      setShowInstallBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
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

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false)
    }
  }

  return (
    <div className="bg-[#0d1117] text-[#e6edf3]" style={{ display: 'flex', height: '100vh' }}>
      {showInstallBanner && isMobile ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(135deg, #161b22, #1c2128)',
            borderBottom: '1px solid #21262d',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 2000,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
            <div>
              <div style={{ color: 'white', fontSize: '13px', fontWeight: 'bold' }}>
                Install DSA Tracker
              </div>
              <div style={{ color: '#8b949e', fontSize: '11px' }}>
                Add to home screen for the best experience
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={() => setShowInstallBanner(false)}
              style={{
                background: 'transparent',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#8b949e',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Later
            </button>
            <button
              onClick={handleInstall}
              style={{
                background: '#58a6ff',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Install
            </button>
          </div>
        </div>
      ) : null}
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
