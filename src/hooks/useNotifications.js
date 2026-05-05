import { getTodaysDueRevisions } from '../utils/revisionUtils'
import { getProblems, getSettings, STORAGE_KEYS } from '../utils/storage'

const LAST_REMINDER_KEY = 'lastReminderFired'
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
const PUSH_SUBSCRIPTION_KEY = STORAGE_KEYS.pushSubscription

const getNotificationSupport = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, reason: 'unsupported' }
  }

  if (!window.isSecureContext) {
    return { supported: false, reason: 'insecure' }
  }

  return { supported: true, reason: 'ok' }
}

const getPushSupport = () => {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'unsupported' }
  }

  if (!('Notification' in window)) {
    return { supported: false, reason: 'unsupported' }
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false, reason: 'unsupported' }
  }

  if (!window.isSecureContext) {
    return { supported: false, reason: 'insecure' }
  }

  return { supported: true, reason: 'ok' }
}

const readStoredPushSubscription = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  const raw = window.localStorage.getItem(PUSH_SUBSCRIPTION_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const saveStoredPushSubscription = (subscription) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.setItem(PUSH_SUBSCRIPTION_KEY, JSON.stringify(subscription))
}

const clearStoredPushSubscription = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.removeItem(PUSH_SUBSCRIPTION_KEY)
}

const sendSubscriptionToServer = async (path, method, settings) => {
  const support = getPushSupport()
  if (!support.supported) {
    return { ok: false, reason: support.reason }
  }

  const registration = await getServiceWorkerRegistration()
  const subscription =
    (await registration?.pushManager.getSubscription()) || readStoredPushSubscription()

  if (!subscription) {
    return { ok: false, reason: 'missing-subscription' }
  }

  saveStoredPushSubscription(subscription)

  try {
    const response = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription, settings }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      return { ok: false, reason: errorBody?.error || 'server' }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, reason: 'network' }
  }
}

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}

const getServiceWorkerRegistration = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) {
    return existing
  }

  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
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

export const getVapidPublicKey = () => VAPID_PUBLIC_KEY

export const ensurePushSubscription = async () => {
  const support = getPushSupport()
  if (!support.supported) {
    return { ok: false, reason: support.reason }
  }

  if (!VAPID_PUBLIC_KEY) {
    return { ok: false, reason: 'missing-key' }
  }

  if (Notification.permission !== 'granted') {
    return { ok: false, reason: 'permission' }
  }

  const registration = await getServiceWorkerRegistration()
  if (!registration) {
    return { ok: false, reason: 'registration' }
  }

  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription) {
    saveStoredPushSubscription(existingSubscription)
    return { ok: true, subscription: existingSubscription }
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    saveStoredPushSubscription(subscription)
    return { ok: true, subscription }
  } catch (error) {
    return { ok: false, reason: 'subscribe' }
  }
}

export const saveSubscriptionToServer = async (settings) =>
  sendSubscriptionToServer('/api/save-subscription', 'POST', settings)

export const deleteSubscriptionFromServer = async () =>
  sendSubscriptionToServer('/api/delete-subscription', 'DELETE')

export const unsubscribeFromPush = async () => {
  const support = getPushSupport()
  if (!support.supported) {
    clearStoredPushSubscription()
    return { ok: false, reason: support.reason }
  }

  const registration = await getServiceWorkerRegistration()
  if (!registration) {
    clearStoredPushSubscription()
    return { ok: false, reason: 'registration' }
  }

  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription) {
    await existingSubscription.unsubscribe()
  }

  clearStoredPushSubscription()
  return { ok: true }
}

export const sendPushMessage = async (payload) => {
  const support = getPushSupport()
  if (!support.supported) {
    return { ok: false, reason: support.reason }
  }

  const registration = await getServiceWorkerRegistration()
  if (!registration) {
    return { ok: false, reason: 'registration' }
  }

  const subscription =
    (await registration.pushManager.getSubscription()) || readStoredPushSubscription()
  if (!subscription) {
    return { ok: false, reason: 'missing-subscription' }
  }

  saveStoredPushSubscription(subscription)

  try {
    const response = await fetch('/api/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription, payload }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      return { ok: false, reason: errorBody?.error || 'server' }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, reason: 'network' }
  }
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
  window.localStorage.removeItem(PUSH_SUBSCRIPTION_KEY)
}
