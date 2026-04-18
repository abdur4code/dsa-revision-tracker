import { startOfDay } from 'date-fns'
import { getProblems, getSettings, STORAGE_KEYS } from '../utils/storage'

const LAST_REMINDER_KEY = 'dsa-revision-tracker:lastReminderAt'

const parseTimeToMinutes = (value, fallback) => {
  if (!value || typeof value !== 'string') {
    return fallback
  }

  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return fallback
  }

  return hours * 60 + minutes
}

const isWithinWindow = (nowMinutes, startMinutes, endMinutes) => {
  if (startMinutes === endMinutes) {
    return true
  }

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes
  }

  return nowMinutes >= startMinutes || nowMinutes <= endMinutes
}

const shouldFireReminder = (frequency, lastFiredAt, now) => {
  if (!lastFiredAt) {
    return true
  }

  if (frequency === 'once') {
    return lastFiredAt.toDateString() !== now.toDateString()
  }

  const diffMs = now.getTime() - lastFiredAt.getTime()
  const thresholdMs = frequency === '1h' ? 60 * 60 * 1000 : 2 * 60 * 60 * 1000
  return diffMs >= thresholdMs
}

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
  if (!settings?.notificationsEnabled) {
    return
  }

  const support = getNotificationSupport()
  if (!support.supported || Notification.permission !== 'granted') {
    return
  }

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = parseTimeToMinutes(settings.reminderStart, 9 * 60)
  const endMinutes = parseTimeToMinutes(settings.reminderEnd, 21 * 60)

  if (!isWithinWindow(nowMinutes, startMinutes, endMinutes)) {
    return
  }

  const lastFiredRaw = window.localStorage.getItem(LAST_REMINDER_KEY)
  const lastFiredAt = lastFiredRaw ? new Date(lastFiredRaw) : null
  const frequency = settings.reminderFrequency || '2h'

  if (!shouldFireReminder(frequency, lastFiredAt, now)) {
    return
  }

  const today = startOfDay(now)
  const problems = getProblems()
  const dueProblems = problems.filter((problem) => {
    const revisions = Array.isArray(problem?.revisions) ? problem.revisions : []

    return revisions.some((revision) => {
      if (revision?.completedDate) {
        return false
      }

      if (!revision?.dueDate) {
        return false
      }

      const dueDate = startOfDay(new Date(revision.dueDate))
      return dueDate <= today
    })
  })

  if (dueProblems.length === 0) {
    return
  }

  const title = 'Revision reminder'
  const sample = dueProblems.slice(0, 3).map((problem) => problem.title).join(', ')
  const body =
    dueProblems.length === 1
      ? `${sample} is due for revision.`
      : `${dueProblems.length} problems need revision. ${sample}${dueProblems.length > 3 ? '...' : ''}`

  sendNotification(title, body, `${window.location.origin}/today`)
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
