import { BarChart2, BookOpen, LayoutDashboard, RefreshCw, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/problems', label: 'Problems', icon: BookOpen },
  { to: '/today', label: "Today's Revision", icon: RefreshCw },
  { to: '/stats', label: 'Stats', icon: BarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function BottomNav({ isMobile, dueCount }) {
  if (!isMobile) {
    return null
  }

  return (
    <nav className="bottom-nav">
      <style>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 52px;
          background: rgba(13, 17, 23, 0.95);
          backdrop-filter: blur(12px);
          border-top: 1px solid #21262d;
          z-index: 1000;
          display: flex;
          padding-bottom: env(safe-area-inset-bottom);
        }

        .bottom-nav-item {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          cursor: pointer;
          position: relative;
          color: #8b949e;
          text-decoration: none;
          transition: transform 100ms ease;
        }

        .bottom-nav-item:active {
          transform: scale(0.92);
        }

        .bottom-nav-item:hover {
          color: #e6edf3;
        }

        .bottom-nav-item-active {
          color: #58a6ff;
        }

        .bottom-nav-item-active:hover {
          color: #58a6ff;
        }

        .bottom-nav-active-bar {
          position: absolute;
          top: 0;
          left: 20%;
          right: 20%;
          height: 2px;
          background: #58a6ff;
          border-radius: 0 0 2px 2px;
        }

        .bottom-nav-due-dot {
          width: 7px;
          height: 7px;
          background: #f85149;
          border-radius: 50%;
          position: absolute;
          top: 8px;
          right: calc(50% - 18px);
          animation: bottomNavPulse 2s ease infinite;
        }

        @keyframes bottomNavPulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(0.8);
          }
        }
      `}</style>
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          aria-label={label}
          className={({ isActive }) =>
            `bottom-nav-item${isActive ? ' bottom-nav-item-active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? <span className="bottom-nav-active-bar" /> : null}
              <Icon size={24} />
              {to === '/today' && dueCount > 0 ? <span className="bottom-nav-due-dot" /> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default BottomNav
