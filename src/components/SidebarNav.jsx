import { useEffect, useMemo, useState } from 'react'
import { format, startOfDay, subDays } from 'date-fns'
import {
  BarChart2,
  BookOpen,
  ExternalLink,
  LayoutDashboard,
  RefreshCw,
  Settings,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { getTodaysDueRevisions } from '../utils/revisionUtils'
import { getProblems } from '../utils/storage'

const DSA_REPO_URL = 'https://github.com/abdur4code/dsa-revision-tracker'

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

function SidebarNav() {
  const [problems, setProblems] = useState([])

  useEffect(() => {
    setProblems(getProblems())
  }, [])

  const dueRevisionsCount = useMemo(() => getTodaysDueRevisions(problems).length, [problems])
  const currentStreak = useMemo(() => calculateCurrentStreak(problems), [problems])

  return (
    <aside className="w-full border-b border-[#21262d] bg-[#0d1117] md:fixed md:left-0 md:top-0 md:h-screen md:w-[240px] md:border-b-0 md:border-r">
      <div className="flex h-full flex-col px-4 py-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base" style={{ color: '#58a6ff' }}>⚡</span>
            <h1 className="text-lg font-bold text-white">DSA Tracker</h1>
          </div>
          <p className="mt-1 text-xs text-[#8b949e]">MAANG or bust. 🎯</p>
          <div className="mt-4 h-px bg-[#21262d]" />
        </div>

        <nav className="mt-4">
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const showDueDot = to === '/today' && dueRevisionsCount > 0

              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      [
                        'flex items-center justify-between border-l-[3px] px-4 py-2.5 text-[14px] font-medium transition-all duration-150 ease-in-out',
                        isActive
                          ? 'border-l-[#58a6ff] bg-[#161b22] text-white'
                          : 'border-l-transparent text-[#8b949e] hover:bg-[#161b22] hover:text-[#e6edf3]',
                      ].join(' ')
                    }
                  >
                    <span className="flex items-center gap-[10px]">
                      <Icon size={16} />
                      <span>{label}</span>
                    </span>
                    {showDueDot ? <span className="h-2 w-2 rounded-full bg-rose-500" /> : null}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-auto border-t border-[#21262d] pt-4">
          <p className={`text-sm ${currentStreak > 0 ? 'text-orange-300' : 'text-[#8b949e]'}`}>
            🔥 {currentStreak} day streak
          </p>

          <a
            href={DSA_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm text-[#8b949e] transition-colors duration-150 ease-in-out hover:text-[#e6edf3]"
          >
            <ExternalLink size={15} />
            <span>DSA Repo</span>
          </a>

          <p className="mt-5 text-[11px] text-[#8b949e] ">
            Built by <a className="hover:text-[#93f5ff] hover:[text-shadow:0_0_10px_rgba(147,245,255,0.8),0_0_20px_rgba(0,191,255,0.5)] transition-all duration-300 ease-in-out" href="https://www.linkedin.com/in/abdur4code/" target="_blank" rel="noopener noreferrer">Abdur Rahim</a>
          </p>
        </div>
      </div>
    </aside>
  )
}

export default SidebarNav
