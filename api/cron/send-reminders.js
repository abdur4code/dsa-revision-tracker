import { kv } from '@vercel/kv'
import webpush from 'web-push'

const SUBSCRIPTIONS_KEY = 'push:subscriptions'

const sendJson = (response, status, body) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

const getCronToken = (request) => {
  const headerSecret = request.headers['x-cron-secret']
  const authHeader = request.headers.authorization
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  const querySecret = request.query?.secret
  return headerSecret || bearerToken || querySecret
}

const isWithinWindow = (currentMinutes, startMinutes, endMinutes) => {
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes
}

const parseTime = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback
  }
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return fallback
  }
  return { hours, minutes }
}

const getFrequencyMinutes = (value) => {
  if (value === 'once') {
    return 99999
  }
  if (value === '1hour') {
    return 60
  }
  return 120
}

const getLocalMinutes = (timezoneOffset) => {
  const now = new Date()
  const local = new Date(now.getTime() - timezoneOffset * 60000)
  return local.getUTCHours() * 60 + local.getUTCMinutes()
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && getCronToken(request) !== cronSecret) {
    sendJson(response, 401, { error: 'Unauthorized' })
    return
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    sendJson(response, 500, { error: 'Missing VAPID keys' })
    return
  }

  const subject = vapidEmail.startsWith('mailto:') ? vapidEmail : `mailto:${vapidEmail}`
  webpush.setVapidDetails(subject, vapidPublicKey, vapidPrivateKey)

  const entries = await kv.hgetall(SUBSCRIPTIONS_KEY)
  if (!entries || Object.keys(entries).length === 0) {
    sendJson(response, 200, { ok: true, sent: 0, skipped: 0 })
    return
  }

  const now = new Date()
  let sent = 0
  let skipped = 0

  for (const [endpoint, rawRecord] of Object.entries(entries)) {
    let record
    try {
      record = typeof rawRecord === 'string' ? JSON.parse(rawRecord) : rawRecord
    } catch {
      await kv.hdel(SUBSCRIPTIONS_KEY, endpoint)
      skipped += 1
      continue
    }

    const settings = record?.settings || {}
    const timezoneOffset = Number.isFinite(settings.timezoneOffset) ? settings.timezoneOffset : 0
    const localMinutes = getLocalMinutes(timezoneOffset)
    const start = parseTime(settings.reminderStart, { hours: 13, minutes: 0 })
    const end = parseTime(settings.reminderEnd, { hours: 21, minutes: 0 })
    const startMinutes = start.hours * 60 + start.minutes
    const endMinutes = end.hours * 60 + end.minutes

    if (!isWithinWindow(localMinutes, startMinutes, endMinutes)) {
      skipped += 1
      continue
    }

    const frequencyMinutes = getFrequencyMinutes(settings.reminderFrequency)
    if (record?.lastSent) {
      const lastSent = new Date(record.lastSent)
      if (!Number.isNaN(lastSent.getTime())) {
        const minutesSinceLast = (now - lastSent) / 60000
        if (minutesSinceLast < frequencyMinutes) {
          skipped += 1
          continue
        }
      }
    }

    const dueCountRaw = Number.isFinite(settings.dueCount)
      ? settings.dueCount
      : Number.isFinite(settings.dailyRevisionTarget)
        ? settings.dailyRevisionTarget
        : 1
    const dueCount = Math.max(1, Math.round(dueCountRaw))

    const payload = {
      title: 'DSA Tracker',
      body: `${dueCount} revision${dueCount === 1 ? '' : 's'} due today. Don't break your streak!`,
      url: '/today',
    }

    try {
      await webpush.sendNotification(record.subscription, JSON.stringify(payload))
      record.lastSent = now.toISOString()
      record.updatedAt = record.updatedAt || now.toISOString()
      await kv.hset(SUBSCRIPTIONS_KEY, { [endpoint]: JSON.stringify(record) })
      sent += 1
    } catch (error) {
      const statusCode = error?.statusCode || error?.status
      if (statusCode === 404 || statusCode === 410) {
        await kv.hdel(SUBSCRIPTIONS_KEY, endpoint)
      }
      skipped += 1
    }
  }

  sendJson(response, 200, { ok: true, sent, skipped })
}
