import { BarChart3, BookOpen, Gauge, Home, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/problems', label: 'Problems', icon: BookOpen },
  { to: '/today', label: "Today's Revision", icon: Gauge },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function SidebarNav() {
  return (
    <aside className="sticky top-0 z-10 w-full border-b border-app-border bg-app-card/90 p-4 backdrop-blur md:h-screen md:w-72 md:border-b-0 md:border-r md:p-6">
      <div className="mb-5 flex items-center justify-between md:mb-8 md:block">
        <h1 className="text-lg font-semibold leading-tight md:text-2xl">
          DSA Revision Tracker
        </h1>
        <p className="hidden text-sm text-app-muted md:block">
          Build consistency, one pattern at a time.
        </p>
      </div>

      <nav>
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-1 md:gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-app-primary/15 text-app-primary'
                      : 'text-app-text hover:bg-white/5',
                  ].join(' ')
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

export default SidebarNav
