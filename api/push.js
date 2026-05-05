import webpush from 'web-push'

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

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    sendJson(response, 500, { error: 'Missing VAPID keys' })
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

  const subject = vapidEmail.startsWith('mailto:') ? vapidEmail : `mailto:${vapidEmail}`
  webpush.setVapidDetails(subject, vapidPublicKey, vapidPrivateKey)

  const notificationPayload = {
    title: body?.payload?.title || 'DSA Tracker',
    body: body?.payload?.body || 'You have a new notification.',
    url: body?.payload?.url || '/',
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(notificationPayload))
    sendJson(response, 200, { ok: true })
  } catch (error) {
    sendJson(response, 500, { error: error?.message || 'Push failed' })
  }
}
