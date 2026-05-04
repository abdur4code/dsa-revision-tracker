import { Flame, Zap } from 'lucide-react'

function MobileHeader({ streak }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '52px',
        background: 'rgba(13, 17, 23, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 1000,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Zap size={18} color="#58a6ff" />
        <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>DSA Tracker</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Flame size={16} color="#f97316" />
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#ffffff',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {streak}
        </span>
      </div>
    </div>
  )
}

export default MobileHeader
