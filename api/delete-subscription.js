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

export default async function handler(request, response) {
  if (request.method !== 'DELETE') {
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
  const endpoint = subscription?.endpoint || body?.endpoint
  if (!endpoint) {
    sendJson(response, 400, { error: 'Missing subscription endpoint' })
    return
  }

  await kv.hdel(SUBSCRIPTIONS_KEY, endpoint)
  sendJson(response, 200, { ok: true })
}
