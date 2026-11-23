import { isIP } from 'node:net'
import { getHeader, getRequestIP, type H3Event } from 'h3'
export function clientAddress(event: H3Event): string {
  // Vercel overwrites X-Forwarded-For. Never trust client-supplied proxy headers on a direct Node server.
  if (process.env.VERCEL === '1') {
    const forwarded = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded && isIP(forwarded)) return forwarded
  }
  return getRequestIP(event) || 'unknown'
}
