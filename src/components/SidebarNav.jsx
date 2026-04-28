import { useCallback, useEffect, useState } from 'react'
import { format, startOfDay, subDays } from 'date-fns'
import {
  BarChart2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  RefreshCw,
  Settings,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { getTodaysDueRevisions } from '../utils/revisionUtils'
import { getProblems } from '../utils/storage'

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

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/problems', label: 'Problems', icon: BookOpen },
  { to: '/today', label: "Today's Revision", icon: RefreshCw },
  { to: '/stats', label: 'Stats', icon: BarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function SidebarNav({ isCollapsed, onToggle }) {
  const [dueRevisionsCount, setDueRevisionsCount] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(0)

  const recalculateSidebarStats = useCallback(() => {
    const latestProblems = getProblems()
    setDueRevisionsCount(getTodaysDueRevisions(latestProblems).length)
    setCurrentStreak(calculateCurrentStreak(latestProblems))
  }, [])

  useEffect(() => {
    recalculateSidebarStats()
  }, [recalculateSidebarStats])

  useEffect(() => {
    const handleUpdate = () => {
      recalculateSidebarStats()
    }

    window.addEventListener('trackerDataUpdated', handleUpdate)
    return () => window.removeEventListener('trackerDataUpdated', handleUpdate)
  }, [recalculateSidebarStats])

  return (
    <aside
      className="h-screen shrink-0 border-r border-[#21262d] bg-[#0d1117]"
      style={{
        width: isCollapsed ? '56px' : '240px',
        transition: 'width 250ms ease',
      }}
    >
      <style>{`
        @keyframes sidebarPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }
      `}</style>

      <div className="flex h-full flex-col py-4">
        <div className="px-2 pb-4">
          <div className={`flex ${isCollapsed ? 'justify-center' : 'items-center gap-2 px-2'}`}>
            <span className="text-[20px]" style={{ color: '#58a6ff' }}>⚡</span>
            {!isCollapsed ? <h1 className="text-[16px] font-bold text-white">DSA Tracker</h1> : null}
          </div>
          {!isCollapsed ? <p className="mt-1 px-2 text-[11px] text-[#8b949e]">MAANG or bust. 🎯</p> : null}
        </div>

        <div className="h-px bg-[#21262d]" />

        <nav className="mt-3">
          <ul className="space-y-0.5">
            {navItems.map(({ to, label, icon: Icon }) => {
              const showDueDot = to === '/today' && dueRevisionsCount > 0

              return (
                <li key={to} className="group relative">
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      [
                        'relative mx-2 flex items-center rounded-[10px] border py-[10px] text-[14px] font-medium transition-all duration-150 ease-in-out',
                        isCollapsed ? 'justify-center px-0' : 'px-3',
                        isActive
                          ? 'border-[rgba(88,166,255,0.2)] bg-[rgba(88,166,255,0.12)] text-[#58a6ff]'
                          : 'border-transparent text-[#8b949e] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#e6edf3]',
                      ].join(' ')
                    }
                  >
                    <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-[10px]'}`}>
                      <Icon size={16} />
                      {!isCollapsed ? <span>{label}</span> : null}
                    </span>
                    {showDueDot ? (
                      <span
                        className="absolute right-[10px] h-[7px] w-[7px] rounded-full bg-[#f85149]"
                        style={{ animation: 'sidebarPulse 2s ease infinite' }}
                      />
                    ) : null}
                  </NavLink>

                  {isCollapsed ? (
                    <span
                      className="pointer-events-none absolute left-[56px] top-1/2 z-[100] -translate-y-1/2 whitespace-nowrap rounded-md bg-[#1c2128] px-[10px] py-1 text-[12px] text-white opacity-0 shadow-lg transition-all duration-150 group-hover:opacity-100"
                    >
                      {label}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={onToggle}
            className={`w-full cursor-pointer rounded-[10px] border border-transparent bg-transparent p-[10px] text-[12px] text-[#8b949e] transition-all hover:bg-[#161b22] hover:text-white ${
              isCollapsed ? 'flex items-center justify-center' : 'flex items-center gap-2'
            }`}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!isCollapsed ? <span>Collapse</span> : null}
          </button>
        </div>

        <div className="mt-auto">
          {isCollapsed ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px 0',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '16px' }}>🔥</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: currentStreak > 0 ? '#f97316' : '#484f58',
                  fontFamily: 'monospace',
                }}
              >
                {currentStreak}
              </span>
            </div>
          ) : (
            <>
              <div
                className="mx-2 rounded-[10px] border px-3 py-[10px]"
                style={
                  currentStreak > 0
                    ? {
                        background: 'rgba(249,115,22,0.08)',
                        borderColor: 'rgba(249,115,22,0.15)',
                      }
                    : {
                        background: 'rgba(22,27,34,0.6)',
                        borderColor: '#21262d',
                      }
                }
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: currentStreak > 0 ? '#f97316' : '#8b949e' }}>🔥</span>
                  <span className={`font-semibold ${currentStreak > 0 ? 'text-white' : 'text-[#8b949e]'}`}>
                    {currentStreak} day streak
                  </span>
                </div>
              </div>

              <p className="px-2 py-2 text-center text-[10px] text-[#484f58]">
                Built by{' '}
                <a
                  className="transition-colors duration-200 hover:text-[#93f5ff]"
                  href="https://www.linkedin.com/in/abdur4code/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abdur Rahim
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export default SidebarNav
