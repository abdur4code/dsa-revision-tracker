import { kv } from '@vercel/kv'

const SUBSCRIPTIONS_KEY = 'push:subscriptions'

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    let raw = ''
    request.on('data', (chunk) => {
      raw += chunk
    })
    request.on('end', () => {
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
  })

const sendJson = (response, status, body) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

const normalizeSettings = (settings = {}) => ({
  reminderStart: typeof settings.reminderStart === 'string' ? settings.reminderStart : '13:00',
  reminderEnd: typeof settings.reminderEnd === 'string' ? settings.reminderEnd : '21:00',
  reminderFrequency:
    typeof settings.reminderFrequency === 'string' ? settings.reminderFrequency : '2hours',
  timezoneOffset: Number.isFinite(settings.timezoneOffset) ? settings.timezoneOffset : 0,
  dailyRevisionTarget: Number.isFinite(settings.dailyRevisionTarget)
    ? settings.dailyRevisionTarget
    : 3,
  dueCount: Number.isFinite(settings.dueCount) ? settings.dueCount : null,
})

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch {
    sendJson(response, 400, { error: 'Invalid JSON body' })
    return
  }

  const subscription = body?.subscription
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    sendJson(response, 400, { error: 'Invalid subscription payload' })
    return
  }

  const endpoint = subscription.endpoint
  const settings = normalizeSettings(body?.settings)

  let lastSent = null
  const existing = await kv.hget(SUBSCRIPTIONS_KEY, endpoint)
  if (existing) {
    try {
      const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing
      lastSent = parsed?.lastSent || null
    } catch {
      lastSent = null
    }
  }

  const record = {
    subscription,
    settings,
    lastSent,
    updatedAt: new Date().toISOString(),
  }

  await kv.hset(SUBSCRIPTIONS_KEY, { [endpoint]: JSON.stringify(record) })

  sendJson(response, 200, { ok: true })
}
