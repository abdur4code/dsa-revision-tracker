import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Clock } from 'lucide-react'

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

const parseTimeValue = (value) => {
  if (typeof value !== 'string') {
    return { hour: '00', minute: '00' }
  }

  const [rawHour, rawMinute] = value.split(':')
  const hour = rawHour ? rawHour.padStart(2, '0') : '00'
  const minute = rawMinute ? rawMinute.padStart(2, '0') : '00'

  return { hour, minute }
}

const formatTime = (hour, minute) => `${hour}:${minute}`

function TimePicker({ value, onChange }) {
  const { hour, minute } = useMemo(() => parseTimeValue(value), [value])
  const [isOpen, setIsOpen] = useState(false)
  const [draftHour, setDraftHour] = useState(hour)
  const [draftMinute, setDraftMinute] = useState(minute)
  const [touchedHour, setTouchedHour] = useState(false)
  const [touchedMinute, setTouchedMinute] = useState(false)
  const containerRef = useRef(null)
  const hourListRef = useRef(null)
  const minuteListRef = useRef(null)

  useEffect(() => {
    setDraftHour(hour)
    setDraftMinute(minute)
  }, [hour, minute])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    setTouchedHour(false)
    setTouchedMinute(false)

    const timer = setTimeout(() => {
      const hourEl = hourListRef.current?.querySelector(`[data-value="${draftHour}"]`)
      const minuteEl = minuteListRef.current?.querySelector(`[data-value="${draftMinute}"]`)
      hourEl?.scrollIntoView({ block: 'center' })
      minuteEl?.scrollIntoView({ block: 'center' })
    }, 0)

    return () => clearTimeout(timer)
  }, [isOpen, draftHour, draftMinute])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleOutside = (event) => {
      if (!containerRef.current || containerRef.current.contains(event.target)) {
        return
      }

      if (touchedHour || touchedMinute) {
        onChange?.(formatTime(draftHour, draftMinute))
      }

      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)

    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [isOpen, touchedHour, touchedMinute, draftHour, draftMinute, onChange])

  const handleToggle = () => {
    if (isOpen) {
      if (touchedHour || touchedMinute) {
        onChange?.(formatTime(draftHour, draftMinute))
      }
      setIsOpen(false)
      return
    }

    setIsOpen(true)
  }

  const handleHourSelect = (nextHour) => {
    const shouldCommit = touchedMinute
    setDraftHour(nextHour)
    setTouchedHour(true)

    if (shouldCommit) {
      onChange?.(formatTime(nextHour, draftMinute))
      setIsOpen(false)
    }
  }

  const handleMinuteSelect = (nextMinute) => {
    const shouldCommit = touchedHour
    setDraftMinute(nextMinute)
    setTouchedMinute(true)

    if (shouldCommit) {
      onChange?.(formatTime(draftHour, nextMinute))
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="flex min-w-[120px] items-center gap-2 rounded-lg border border-[#30363d] bg-[#0d1117] px-[14px] py-[10px] text-[14px] text-white transition hover:border-[#58a6ff]"
      >
        <Clock size={16} color="#58a6ff" />
        <span className="font-mono">{formatTime(draftHour, draftMinute)}</span>
        <ChevronDown size={16} color="#8b949e" className="ml-auto" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-[1000] mt-2 flex w-[180px] overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex-1 border-r border-[#21262d]">
            <div className="bg-[#21262d] px-2 py-2 text-center text-[11px] uppercase tracking-[0.1em] text-[#8b949e]">
              HH
            </div>
            <div
              ref={hourListRef}
              className="timepicker-scroll h-[200px] overflow-y-scroll px-2 py-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {HOURS.map((option) => {
                const isSelected = option === draftHour
                return (
                  <button
                    key={option}
                    type="button"
                    data-value={option}
                    onClick={() => handleHourSelect(option)}
                    className={`w-full rounded-md px-2 py-2 text-center font-mono text-[15px] transition ${
                      isSelected
                        ? 'bg-[#58a6ff] font-semibold text-white'
                        : 'text-[#c9d1d9] hover:bg-[rgba(88,166,255,0.15)] hover:text-[#58a6ff]'
                    }`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex-1">
            <div className="bg-[#21262d] px-2 py-2 text-center text-[11px] uppercase tracking-[0.1em] text-[#8b949e]">
              MM
            </div>
            <div
              ref={minuteListRef}
              className="timepicker-scroll h-[200px] overflow-y-scroll px-2 py-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {MINUTES.map((option) => {
                const isSelected = option === draftMinute
                return (
                  <button
                    key={option}
                    type="button"
                    data-value={option}
                    onClick={() => handleMinuteSelect(option)}
                    className={`w-full rounded-md px-2 py-2 text-center font-mono text-[15px] transition ${
                      isSelected
                        ? 'bg-[#58a6ff] font-semibold text-white'
                        : 'text-[#c9d1d9] hover:bg-[rgba(88,166,255,0.15)] hover:text-[#58a6ff]'
                    }`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default TimePicker
