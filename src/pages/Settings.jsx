import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, Database, Download, RefreshCw, Trash2, Upload } from 'lucide-react'
import TimePicker from '../components/TimePicker'
import { getProblems, getSettings, saveSettings, STORAGE_KEYS } from '../utils/storage'
import { getNotificationDiagnostics, requestPermission, sendNotification } from '../hooks/useNotifications'

const DEFAULT_SETTINGS = {
  notificationsEnabled: false,
  reminderStart: '13:00',
  reminderEnd: '21:00',
  reminderFrequency: '2hours',
  useExtendedRule: false,
}

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Once', summary: 'Once' },
  { value: '2hours', label: 'Every 2 hrs', summary: 'Every 2 hours' },
  { value: '1hour', label: 'Every hour', summary: 'Every hour' },
]

const REVISION_RULE_BASE = 'Day 1 → 7 → 30 → 60'
const REVISION_RULE_EXTENDED = 'Day 1 → 3 → 7 → 15 → 30 → 60 → 120'
const STANDARD_DAYS = [1, 7, 30, 60]
const EXTENDED_DAYS = [1, 3, 7, 15, 30, 60, 120]

const STATUS_STYLES = {
  active: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  blocked: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  idle: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
}

const TOAST_STYLES = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  info: 'border-[#21262d] bg-[#161b22] text-[#c9d1d9]',
}

const normalizeSettings = (settings) => {
  const normalizedFrequency =
    settings.reminderFrequency === '2h'
      ? '2hours'
      : settings.reminderFrequency === '1h'
        ? '1hour'
        : settings.reminderFrequency
  const derivedUseExtendedRule = settings.useExtendedRule ?? settings.useExtendedRevisionRule

  return {
    ...settings,
    notificationsEnabled: Boolean(settings.notificationsEnabled),
    reminderStart: settings.reminderStart || DEFAULT_SETTINGS.reminderStart,
    reminderEnd: settings.reminderEnd || DEFAULT_SETTINGS.reminderEnd,
    reminderFrequency: normalizedFrequency || DEFAULT_SETTINGS.reminderFrequency,
    useExtendedRule: Boolean(derivedUseExtendedRule),
  }
}

const buildSettingsState = (rawSettings) =>
  normalizeSettings({
    ...DEFAULT_SETTINGS,
    ...(rawSettings || {}),
  })

const getFrequencyLabel = (value, summary = false) => {
  const match = FREQUENCY_OPTIONS.find((option) => option.value === value)
  if (!match) {
    return value || ''
  }
  return summary ? match.summary : match.label
}

const formatRuleSummary = (useExtended) =>
  useExtended
    ? 'Extended (1→3→7→15→30→60→120)'
    : 'Standard (1→7→30→60)'

const buildChangeList = (current, saved) => {
  const changes = []

  if (current.notificationsEnabled !== saved.notificationsEnabled) {
    changes.push(`Push notifications: ${current.notificationsEnabled ? 'On' : 'Off'}`)
  }

  if (current.reminderStart !== saved.reminderStart || current.reminderEnd !== saved.reminderEnd) {
    changes.push(`Notification window: ${current.reminderStart} - ${current.reminderEnd}`)
  }

  if (current.reminderFrequency !== saved.reminderFrequency) {
    changes.push(`Reminder frequency: ${getFrequencyLabel(current.reminderFrequency, true)}`)
  }

  if (current.useExtendedRule !== saved.useExtendedRule) {
    changes.push(`Revision rule: ${formatRuleSummary(current.useExtendedRule)}`)
  }

  return changes
}

const ModalShell = ({ title, children, actions }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="w-full max-w-sm rounded-2xl border border-[#21262d] bg-[#161b22] p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-2 text-sm text-[#8b949e]">{children}</div>
      <div className="mt-5 flex items-center justify-end gap-3">{actions}</div>
    </div>
  </div>
)

function Settings() {
  const fileInputRef = useRef(null)
  const [savedSettings, setSavedSettings] = useState(() => buildSettingsState(getSettings()))
  const [formState, setFormState] = useState(() => buildSettingsState(getSettings()))
  const [notificationStatus, setNotificationStatus] = useState(() => getNotificationDiagnostics())
  const [toast, setToast] = useState(null)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const [isRuleConfirmOpen, setIsRuleConfirmOpen] = useState(false)
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false)
  const [pendingRuleValue, setPendingRuleValue] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const loaded = buildSettingsState(getSettings())
    setSavedSettings(loaded)
    setFormState(loaded)
    setNotificationStatus(getNotificationDiagnostics())
  }, [])

  const updateFormState = (updates) => {
    setFormState((prev) => ({
      ...prev,
      ...updates,
    }))
  }

  const activeRule = useMemo(
    () => (formState.useExtendedRule ? REVISION_RULE_EXTENDED : REVISION_RULE_BASE),
    [formState.useExtendedRule],
  )

  const notificationMeta = useMemo(() => {
    if (!notificationStatus.supported) {
      return { label: 'Blocked ✗', tone: 'blocked' }
    }
    if (notificationStatus.permission === 'granted') {
      return { label: 'Active ✓', tone: 'active' }
    }
    if (notificationStatus.permission === 'denied') {
      return { label: 'Blocked ✗', tone: 'blocked' }
    }
    return { label: 'Not enabled', tone: 'idle' }
  }, [notificationStatus])

  const changes = useMemo(
    () => buildChangeList(formState, savedSettings),
    [formState, savedSettings],
  )

  const hasChanges = changes.length > 0

  const handleNotificationToggle = async (checked) => {
    if (!checked) {
      updateFormState({ notificationsEnabled: false })
      showToast('Notifications disabled.', 'info')
      return
    }

    const permission = await requestPermission()
    if (permission === 'unsupported') {
      updateFormState({ notificationsEnabled: false })
      showToast('Notifications are not supported in this browser.', 'error')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }
    if (permission === 'insecure') {
      updateFormState({ notificationsEnabled: false })
      showToast('Notifications require HTTPS or localhost to work.', 'error')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }
    if (permission !== 'granted') {
      updateFormState({ notificationsEnabled: false })
      showToast('Notification permission denied or unavailable.', 'error')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }

    updateFormState({ notificationsEnabled: true })
    showToast('Notifications enabled!')
    setNotificationStatus(getNotificationDiagnostics())
  }

  const handleSendTest = async () => {
    const permission = await requestPermission()
    if (permission === 'unsupported') {
      showToast('Notifications are not supported in this browser.', 'error')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }
    if (permission === 'insecure') {
      showToast('Notifications require HTTPS or localhost to work.', 'error')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }
    if (permission !== 'granted') {
      showToast('Enable notifications in your browser first.', 'error')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }

    const result = sendNotification(
      'DSA Tracker Test',
      'Notifications are working. Keep the streak alive.',
      `${window.location.origin}/today`,
    )

    if (!result?.ok) {
      showToast('Notification blocked by the browser. Check site permissions.', 'error')
      setNotificationStatus(getNotificationDiagnostics())
      return
    }

    showToast('Test notification sent. If you do not see it, check OS-level notification settings.')
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
    showToast('Export ready.')
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
      const normalizedSettings = buildSettingsState(importedSettings)

      window.localStorage.setItem(STORAGE_KEYS.problems, JSON.stringify(importedProblems))
      window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(normalizedSettings))
      setSavedSettings(normalizedSettings)
      setFormState(normalizedSettings)
      showToast('Import complete.')
    } catch (error) {
      showToast('Import failed. Please use a valid JSON export file.', 'error')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClearData = () => {
    window.localStorage.removeItem(STORAGE_KEYS.problems)
    window.localStorage.removeItem(STORAGE_KEYS.settings)
    const clearedSettings = buildSettingsState(getSettings())
    setSavedSettings(clearedSettings)
    setFormState(clearedSettings)
    setIsClearConfirmOpen(false)
    showToast('All data cleared.')
  }

  const handleRuleSelect = (nextValue) => {
    if (nextValue === formState.useExtendedRule) {
      return
    }

    updateFormState({ useExtendedRule: nextValue })

    if (nextValue !== savedSettings.useExtendedRule) {
      setPendingRuleValue(nextValue)
      setIsRuleConfirmOpen(true)
    }
  }

  const handleConfirmRuleChange = () => {
    if (pendingRuleValue === null) {
      setIsRuleConfirmOpen(false)
      return
    }

    updateFormState({ useExtendedRule: pendingRuleValue })
    setPendingRuleValue(null)
    setIsRuleConfirmOpen(false)
  }

  const handleSaveSettings = () => {
    const nextSettings = buildSettingsState(saveSettings(formState))
    setSavedSettings(nextSettings)
    setFormState(nextSettings)
    setIsSaveConfirmOpen(false)
    showToast('Settings saved successfully ✓')
  }

  return (
    <section className="page-content mx-auto w-full max-w-[900px] space-y-6 px-10 py-8 max-[900px]:max-w-[600px] max-[900px]:px-6 max-[900px]:py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold text-white">Settings</h1>
        <p className="text-[14px] text-[#8b949e]">Manage notifications, revision schedules, and backups.</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <section className="w-full max-w-[900px] rounded-2xl border border-[#21262d] bg-[#161b22] p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Bell size={20} color="#58a6ff" />
              <h2 className="text-lg font-semibold text-white">Browser Notifications</h2>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                STATUS_STYLES[notificationMeta.tone]
              }`}
            >
              {notificationMeta.label}
            </span>
          </div>
          {notificationStatus.permission === 'denied' ? (
            <p className="mt-2 text-xs text-[#8b949e]">
              Enable in browser settings → chrome://settings/content/notifications
            </p>
          ) : null}

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Push Notifications</p>
                <p className="text-xs text-[#8b949e]">Get reminded when revisions are due</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={Boolean(formState.notificationsEnabled)}
                  onChange={(event) => handleNotificationToggle(event.target.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-[#30363d] transition peer-checked:bg-[#58a6ff]" />
                <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
              </label>
            </div>

            {formState.notificationsEnabled ? (
              <div className="rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
                <p className="text-sm text-[#c9d1d9]">Remind me between</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <TimePicker
                    value={formState.reminderStart}
                    onChange={(value) => updateFormState({ reminderStart: value })}
                  />
                  <span className="text-sm text-[#8b949e]">and</span>
                  <TimePicker
                    value={formState.reminderEnd}
                    onChange={(value) => updateFormState({ reminderEnd: value })}
                  />
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
              <p className="text-sm text-[#c9d1d9]">How often to remind</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {FREQUENCY_OPTIONS.map((option) => {
                  const isActive = formState.reminderFrequency === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateFormState({ reminderFrequency: option.value })}
                      aria-pressed={isActive}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? 'bg-[#58a6ff] text-white'
                          : 'bg-[#21262d] text-[#8b949e] hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSendTest}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#30363d] bg-transparent px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#58a6ff]"
            >
              <Bell size={16} />
              Send Test Notification
            </button>
          </div>
        </section>

        <section className="w-full max-w-[900px] rounded-2xl border border-[#21262d] bg-[#161b22] p-6">
          <div className="flex items-center gap-3">
            <RefreshCw size={20} color="#58a6ff" />
            <h2 className="text-lg font-semibold text-white">Revision Schedule</h2>
          </div>
          <p className="mt-2 text-sm text-[#8b949e]">
            Current rule: <span className="text-white">{activeRule}</span>
          </p>

          <div className="mt-5 grid gap-4">
            <button
              type="button"
              onClick={() => handleRuleSelect(false)}
              className={`relative w-full min-h-[140px] rounded-xl border p-5 text-left transition ${
                formState.useExtendedRule
                  ? 'border-[#21262d] bg-[#0d1117]'
                  : 'border-[#58a6ff] bg-[#0d1117]'
              }`}
            >
              {!formState.useExtendedRule ? (
                <span className="absolute right-3 top-3 rounded-full bg-[#58a6ff] p-1 text-white">
                  <Check size={12} />
                </span>
              ) : null}
              <p className="text-sm font-semibold text-white">Standard (Recommended)</p>
              <p className="mt-1 text-xs text-[#8b949e]">{REVISION_RULE_BASE}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {STANDARD_DAYS.map((day) => (
                  <span
                    key={day}
                    className="rounded-full border border-[#30363d] bg-[#0d1117] px-2 py-0.5 text-[11px] text-[#c9d1d9]"
                  >
                    Day {day}
                  </span>
                ))}
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleRuleSelect(true)}
              className={`relative w-full min-h-[140px] rounded-xl border p-5 text-left transition ${
                formState.useExtendedRule
                  ? 'border-[#58a6ff] bg-[#0d1117]'
                  : 'border-[#21262d] bg-[#0d1117]'
              }`}
            >
              {formState.useExtendedRule ? (
                <span className="absolute right-3 top-3 rounded-full bg-[#58a6ff] p-1 text-white">
                  <Check size={12} />
                </span>
              ) : null}
              <p className="text-sm font-semibold text-white">Extended (Abdur&apos;s Method)</p>
              <p className="mt-1 text-xs text-[#8b949e]">{REVISION_RULE_EXTENDED}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {EXTENDED_DAYS.map((day) => (
                  <span
                    key={day}
                    className="rounded-full border border-[#30363d] bg-[#0d1117] px-2 py-0.5 text-[11px] text-[#c9d1d9]"
                  >
                    Day {day}
                  </span>
                ))}
              </div>
            </button>
          </div>
        </section>

        <section className="w-full max-w-[900px] rounded-2xl border border-[#21262d] bg-[#161b22] p-6">
          <div className="flex items-center gap-3">
            <Database size={20} color="#58a6ff" />
            <h2 className="text-lg font-semibold text-white">Data</h2>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
              <div className="flex items-center gap-3">
                <Download size={18} color="#8b949e" />
                <p className="text-sm text-white">Export all data as JSON</p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-lg border border-[#30363d] bg-transparent px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[#58a6ff]"
              >
                Export
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
              <div className="flex items-center gap-3">
                <Upload size={18} color="#8b949e" />
                <p className="text-sm text-white">Import from JSON backup</p>
              </div>
              <label
                htmlFor="settings-import"
                className="cursor-pointer rounded-lg border border-[#30363d] bg-transparent px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[#58a6ff]"
              >
                Import
              </label>
              <input
                id="settings-import"
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImport}
                className="hidden"
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#21262d] bg-[#0d1117] px-4 py-3">
              <div className="flex items-center gap-3">
                <Trash2 size={18} color="#f87171" />
                <p className="text-sm text-white">Clear all data</p>
              </div>
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(true)}
                className="rounded-lg border border-rose-500/60 bg-transparent px-3 py-1.5 text-sm font-semibold text-rose-200 transition hover:border-rose-500"
              >
                Clear
              </button>
            </div>
          </div>
        </section>
      </div>

      <button
        type="button"
        disabled={!hasChanges}
        onClick={() => hasChanges && setIsSaveConfirmOpen(true)}
        className={`w-full rounded-xl px-4 py-[14px] text-[15px] font-semibold transition ${
          hasChanges
            ? 'bg-[#58a6ff] text-white'
            : 'cursor-not-allowed bg-[#21262d] text-[#8b949e]'
        }`}
      >
        Save Settings
      </button>

      {isRuleConfirmOpen ? (
        <ModalShell
          title="Change Revision Rule?"
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  updateFormState({ useExtendedRule: savedSettings.useExtendedRule })
                  setPendingRuleValue(null)
                  setIsRuleConfirmOpen(false)
                }}
                className="rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-2 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRuleChange}
                className="rounded-lg bg-[#58a6ff] px-4 py-2 text-sm font-semibold text-white"
              >
                Yes, change it
              </button>
            </>
          }
        >
          <p>This won&apos;t affect already scheduled revisions.</p>
          <p>Only new problems will use the new rule.</p>
        </ModalShell>
      ) : null}

      {isSaveConfirmOpen ? (
        <ModalShell
          title="Save these settings?"
          actions={
            <>
              <button
                type="button"
                onClick={() => setIsSaveConfirmOpen(false)}
                className="rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-2 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="rounded-lg bg-[#58a6ff] px-4 py-2 text-sm font-semibold text-white"
              >
                Save &amp; Apply
              </button>
            </>
          }
        >
          {changes.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-sm text-[#c9d1d9]">
              {changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          ) : (
            <p>No changes to save.</p>
          )}
        </ModalShell>
      ) : null}

      {isClearConfirmOpen ? (
        <ModalShell
          title="Clear all data?"
          actions={
            <>
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
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
            </>
          }
        >
          <p>This will remove all problems, revisions, and settings from this device.</p>
        </ModalShell>
      ) : null}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#161b22',
            border: '1px solid #3fb950',
            borderLeft: '4px solid #3fb950',
            borderRadius: '10px',
            padding: '14px 20px',
            color: '#e6edf3',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 9999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'slideInRight 200ms ease',
          }}
        >
          <span style={{ color: '#3fb950', fontSize: '16px' }}>✓</span>
          {toast.message}
        </div>
      ) : null}

      <div
        style={{
          textAlign: 'center',
          padding: '24px 16px 8px 16px',
          fontSize: '11px',
          color: '#484f58',
          marginTop: '32px',
        }}
      >
        Built by{' '}
        <a
          href="https://www.linkedin.com/in/abdur4code"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#58a6ff',
            textDecoration: 'none',
            fontWeight: '500',
          }}
          onMouseEnter={(event) => {
            event.target.style.textDecoration = 'underline'
          }}
          onMouseLeave={(event) => {
            event.target.style.textDecoration = 'none'
          }}
        >
          Abdur Rahim
        </a>
      </div>
    </section>
  )
}

export default Settings
