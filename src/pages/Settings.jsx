import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Download,
  FileUp,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { getProblems, getSettings, saveSettings, STORAGE_KEYS } from '../utils/storage'
import {
  getNotificationDiagnostics,
  requestPermission,
  sendNotification,
} from '../hooks/useNotifications'

const DEFAULT_SETTINGS = {
  notificationsEnabled: false,
  reminderStart: '09:00',
  reminderEnd: '21:00',
  reminderFrequency: '2h',
  useExtendedRevisionRule: false,
  defaultView: 'table',
}

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: '2h', label: 'Every 2 hours' },
  { value: '1h', label: 'Every hour' },
]

const REVISION_RULE_BASE = 'Day 1 → 7 → 30 → 60'
const REVISION_RULE_EXTENDED = 'Day 1 → 3 → 7 → 15 → 30 → 60 → 120'

function Settings() {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...getSettings(),
  }))
  const [message, setMessage] = useState(null)
  const [notificationStatus, setNotificationStatus] = useState(() =>
    getNotificationDiagnostics(),
  )
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      ...getSettings(),
    }))
    setNotificationStatus(getNotificationDiagnostics())
  }, [])

  const updateSettings = (updates) => {
    const nextSettings = {
      ...settings,
      ...updates,
    }

    setSettings(nextSettings)
    saveSettings(nextSettings)
  }

  const handleNotificationToggle = async (checked) => {
    if (!checked) {
      updateSettings({ notificationsEnabled: false })
      setMessage('Notifications disabled.')
      return
    }

    const permission = await requestPermission()
    if (permission === 'unsupported') {
      updateSettings({ notificationsEnabled: false })
      setMessage('Notifications are not supported in this browser.')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }
    if (permission === 'insecure') {
      updateSettings({ notificationsEnabled: false })
      setMessage('Notifications require HTTPS or localhost to work.')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }
    if (permission !== 'granted') {
      updateSettings({ notificationsEnabled: false })
      setMessage('Notification permission denied or unavailable.')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }

    updateSettings({ notificationsEnabled: true })
    setMessage('Notifications enabled!')
    setNotificationStatus(getNotificationDiagnostics())
  }

  const handleSendTest = async () => {
    const permission = await requestPermission()
    if (permission === 'unsupported') {
      setMessage('Notifications are not supported in this browser.')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }
    if (permission === 'insecure') {
      setMessage('Notifications require HTTPS or localhost to work.')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }
    if (permission !== 'granted') {
      setMessage('Enable notifications in your browser first.')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }

    const result = sendNotification(
      'DSA Tracker Test',
      'Notifications are working. Keep the streak alive.',
      `${window.location.origin}/today`,
    )

    if (!result?.ok) {
      setMessage('Notification blocked by the browser. Check site permissions.')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }

    setMessage('Test notification sent. If you do not see it, check OS-level notification settings.')
    setNotificationStatus(getNotificationDiagnostics())
  }

  const handleExport = () => {
    const payload = {
      problems: getProblems(),
      settings: getSettings(),
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'dsa-tracker-export.json'
    link.click()
    window.URL.revokeObjectURL(url)
    setMessage('Export ready.')
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const importedProblems = Array.isArray(parsed?.problems)
        ? parsed.problems
        : Array.isArray(parsed)
          ? parsed
          : []
      const importedSettings = parsed?.settings ? parsed.settings : getSettings()

      window.localStorage.setItem(STORAGE_KEYS.problems, JSON.stringify(importedProblems))
      window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(importedSettings))
      setSettings({ ...DEFAULT_SETTINGS, ...importedSettings })
      setMessage('Import complete.')
    } catch (error) {
      setMessage('Import failed. Please use a valid JSON export file.')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClearData = () => {
    window.localStorage.removeItem(STORAGE_KEYS.problems)
    window.localStorage.removeItem(STORAGE_KEYS.settings)
    setSettings({ ...DEFAULT_SETTINGS })
    setIsConfirmOpen(false)
    setMessage('All data cleared.')
  }

  const activeRule = useMemo(
    () => (settings.useExtendedRevisionRule ? REVISION_RULE_EXTENDED : REVISION_RULE_BASE),
    [settings.useExtendedRevisionRule],
  )

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Bell size={24} color="#58a6ff" />
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
        </div>
        <p className="text-sm text-[#8b949e]">
          Tune notifications, revision rules, and how you view your tracker.
        </p>
      </header>

      {message ? (
        <div className="rounded-xl border border-[#21262d] bg-[#161b22] px-4 py-3 text-sm text-[#c9d1d9]">
          {message}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#21262d] bg-[#161b22] p-5">
        <div className="flex items-center gap-3">
          <Bell size={18} color="#58a6ff" />
          <h2 className="text-lg font-semibold text-white">Notification Settings</h2>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3 text-xs text-[#8b949e]">
            <div className="flex flex-wrap gap-4">
              <span>
                Support:{' '}
                <strong className="text-[#e6edf3]">
                  {notificationStatus.supported ? 'Yes' : 'No'}
                </strong>
              </span>
              <span>
                Secure context:{' '}
                <strong className="text-[#e6edf3]">
                  {notificationStatus.secureContext ? 'Yes' : 'No'}
                </strong>
              </span>
              <span>
                Permission:{' '}
                <strong className="text-[#e6edf3]">
                  {notificationStatus.permission}
                </strong>
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[#6f7b88]">
              If tests still fail, check OS-level notification settings for your browser.
            </p>
          </div>
          <label className="flex items-center justify-between rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
            <span className="text-sm text-[#c9d1d9]">Enable browser push notifications</span>
            <input
              type="checkbox"
              checked={Boolean(settings.notificationsEnabled)}
              onChange={(event) => handleNotificationToggle(event.target.checked)}
              className="h-4 w-4 accent-[#58a6ff]"
            />
          </label>

          <div className="rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
            <p className="text-sm text-[#c9d1d9]">Remind me between</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="time"
                value={settings.reminderStart}
                onChange={(event) => updateSettings({ reminderStart: event.target.value })}
                className="rounded-md border border-[#21262d] bg-[#161b22] px-3 py-2 text-sm text-white"
              />
              <span className="text-sm text-[#8b949e]">and</span>
              <input
                type="time"
                value={settings.reminderEnd}
                onChange={(event) => updateSettings({ reminderEnd: event.target.value })}
                className="rounded-md border border-[#21262d] bg-[#161b22] px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
            <p className="text-sm text-[#c9d1d9]">Reminder frequency in window</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {FREQUENCY_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-[#c9d1d9]">
                  <input
                    type="radio"
                    name="reminderFrequency"
                    value={option.value}
                    checked={settings.reminderFrequency === option.value}
                    onChange={() => updateSettings({ reminderFrequency: option.value })}
                    className="h-4 w-4 accent-[#58a6ff]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendTest}
            className="inline-flex items-center gap-2 rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-2 text-sm font-semibold text-white transition hover:border-[#58a6ff]"
          >
            <CheckCircle2 size={16} />
            Send Test Notification
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#21262d] bg-[#161b22] p-5">
        <div className="flex items-center gap-3">
          <RefreshCw size={18} color="#58a6ff" />
          <h2 className="text-lg font-semibold text-white">Revision Rule Settings</h2>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
            <p className="text-sm text-[#8b949e]">Current rule</p>
            <p className="mt-1 text-sm text-white">{activeRule}</p>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
            <div>
              <p className="text-sm text-white">Use Abdur&apos;s extended rule</p>
              <p className="text-xs text-[#8b949e]">{REVISION_RULE_EXTENDED}</p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(settings.useExtendedRevisionRule)}
              onChange={(event) => updateSettings({ useExtendedRevisionRule: event.target.checked })}
              className="h-4 w-4 accent-[#58a6ff]"
            />
          </label>

          <div className="flex items-center gap-2 text-xs text-[#f6a1a1]">
            <AlertTriangle size={14} />
            Changing this won&apos;t affect already scheduled revisions.
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#21262d] bg-[#161b22] p-5">
        <div className="flex items-center gap-3">
          <Clock size={18} color="#58a6ff" />
          <h2 className="text-lg font-semibold text-white">Display Settings</h2>
        </div>

        <div className="mt-4 rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
          <p className="text-sm text-[#c9d1d9]">Default view</p>
          <div className="mt-3 flex items-center gap-4 text-sm text-[#c9d1d9]">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="defaultView"
                value="table"
                checked={settings.defaultView === 'table'}
                onChange={() => updateSettings({ defaultView: 'table' })}
                className="h-4 w-4 accent-[#58a6ff]"
              />
              Table
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="defaultView"
                value="cards"
                checked={settings.defaultView === 'cards'}
                onChange={() => updateSettings({ defaultView: 'cards' })}
                className="h-4 w-4 accent-[#58a6ff]"
              />
              Cards
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#21262d] bg-[#161b22] p-5">
        <div className="flex items-center gap-3">
          <Download size={18} color="#58a6ff" />
          <h2 className="text-lg font-semibold text-white">Data Management</h2>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-2 text-sm font-semibold text-white transition hover:border-[#58a6ff]"
          >
            <Download size={16} />
            Export all data as JSON
          </button>

          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-2 text-sm font-semibold text-white transition hover:border-[#58a6ff]">
            <FileUp size={16} />
            Import from JSON
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-500"
          >
            <Trash2 size={16} />
            Clear all data
          </button>
        </div>
      </section>

      {isConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#21262d] bg-[#161b22] p-6">
            <h3 className="text-lg font-semibold text-white">Clear all data?</h3>
            <p className="mt-2 text-sm text-[#8b949e]">
              This will remove all problems, revisions, and settings from this device.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-2 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearData}
                className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Yes, clear
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default Settings
