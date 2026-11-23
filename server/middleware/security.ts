import { randomBytes } from 'node:crypto'
export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname.toLowerCase()
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  const nonce = randomBytes(24).toString('base64')
  event.context.cspNonce = nonce
  const production = !import.meta.dev
  const policy = [
    "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "frame-src 'none'",
    "form-action 'self'", "script-src-attr 'none'", "img-src 'self' data:", "font-src 'self' data:",
    // Vue's style bindings require inline styles; inline scripts and eval remain blocked in production.
    "style-src 'self' 'unsafe-inline'",
    production ? `script-src 'nonce-${nonce}' 'strict-dynamic' 'self'` : `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`,
    production ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
  ]
  if (String(useRuntimeConfig().appUrl).startsWith('https:')) policy.push('upgrade-insecure-requests')
  setResponseHeader(event, 'Content-Security-Policy', policy.join('; '))
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (String(useRuntimeConfig().appUrl).startsWith('https:')) setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000')
  if (!path.startsWith('/api/')) return
  if (['GET','HEAD','OPTIONS'].includes(event.method) || ['/api/billing/webhook','/api/reminders'].includes(path)) return
  const origin = getHeader(event, 'origin')
  const allowed = new URL(String(useRuntimeConfig().appUrl)).origin
  if (origin !== allowed) throw createError({ statusCode: 403, statusMessage: 'Invalid request origin' })
  const size = Number(getHeader(event, 'content-length') || 0)
  if (size > 2_000_000) throw createError({ statusCode: 413, statusMessage: 'Request too large' })
})
