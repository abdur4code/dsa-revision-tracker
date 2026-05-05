import { getTodaysDueRevisions } from '../utils/revisionUtils'
import { getProblems, getSettings, STORAGE_KEYS } from '../utils/storage'

const LAST_REMINDER_KEY = 'lastReminderFired'

const getNotificationSupport = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, reason: 'unsupported' }
  }

  if (!window.isSecureContext) {
    return { supported: false, reason: 'insecure' }
  }

  return { supported: true, reason: 'ok' }
}

export const getNotificationDiagnostics = () => {
  const support = getNotificationSupport()
  const permission =
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'

  return {
    supported: support.supported,
    reason: support.reason,
    permission,
    secureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
  }
}

export const requestPermission = async () => {
  const support = getNotificationSupport()
  if (!support.supported) {
    return support.reason
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  return Notification.requestPermission()
}

export const sendNotification = (title, body, url) => {
  const support = getNotificationSupport()
  if (!support.supported) {
    return { ok: false, reason: support.reason }
  }

  if (Notification.permission !== 'granted') {
    return { ok: false, reason: 'permission' }
  }

  try {
    const notification = new Notification(title, {
      body,
      tag: 'dsa-tracker-reminder',
    })

    if (url) {
      notification.onclick = () => {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    }

    return { ok: true, notification }
  } catch (error) {
    return { ok: false, reason: 'blocked' }
  }
}

export const scheduleReminder = (problem, dueDate) => {
  if (!problem) {
    return null
  }

  const title = 'Revision due'
  const dateLabel = dueDate ? new Date(dueDate).toLocaleDateString() : 'today'
  const body = `${problem.title} is due for revision ${dateLabel}.`
  return sendNotification(title, body, problem.problemLink)
}

export const checkAndFireReminders = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  const settings = getSettings()
  if (!settings.notificationsEnabled) return

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  const [startHour, startMin] = (settings.reminderStart || '13:00').split(':').map(Number)
  const [endHour, endMin] = (settings.reminderEnd || '21:00').split(':').map(Number)

  const currentTotalMins = currentHour * 60 + currentMinute
  const startTotalMins = startHour * 60 + startMin
  const endTotalMins = endHour * 60 + endMin

  if (currentTotalMins < startTotalMins || currentTotalMins > endTotalMins) return

  const lastFired = window.localStorage.getItem(LAST_REMINDER_KEY)
  const normalizedFrequency =
    settings.reminderFrequency === '2h'
      ? '2hours'
      : settings.reminderFrequency === '1h'
        ? '1hour'
        : settings.reminderFrequency || '2hours'
  const frequencyMins =
    normalizedFrequency === 'once'
      ? 99999
      : normalizedFrequency === '2hours'
        ? 120
        : 60

  if (lastFired) {
    const minutesSinceLast = (now - new Date(lastFired)) / 60000
    if (minutesSinceLast < frequencyMins) return
  }

  const problems = getProblems()
  const due = getTodaysDueRevisions(problems)
  if (due.length === 0) return

  sendNotification(
    `📚 ${due.length} revision${due.length > 1 ? 's' : ''} due`,
    `Don't break your streak. Review: ${
      due.slice(0, 2).map((problem) => problem.title).join(', ')
    }${due.length > 2 ? ` +${due.length - 2} more` : ''}`,
  )

  window.localStorage.setItem(LAST_REMINDER_KEY, now.toISOString())
}

export const clearReminderState = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.removeItem(LAST_REMINDER_KEY)
}

export const resetNotificationPreferences = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.removeItem(STORAGE_KEYS.settings)
}
