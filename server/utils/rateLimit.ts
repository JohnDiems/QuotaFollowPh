import { createHash } from 'node:crypto'
import { createError } from 'h3'

export async function enforceSharedQuota(key: string, max: number, window: number,
  consume: (body: { bucket_hash: string; max_requests: number; window_ms: number }) => Promise<boolean>) {
  let allowed: boolean
  try { allowed = await consume({ bucket_hash: createHash('sha256').update(key).digest('hex'), max_requests: max, window_ms: window }) }
  catch { throw createError({ statusCode: 503, statusMessage: 'Request protection is unavailable. Please try again later.' }) }
  if (!allowed) throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please wait and try again.' })
}
// A bounded development-only fallback. Production never silently falls back to per-instance counters.
const buckets = new Map<string, { count: number; reset: number }>()
export async function rateLimit(key: string, max = 20, window = 60_000) {
  const c = useRuntimeConfig()
  if (c.supabaseServiceKey) {
    return enforceSharedQuota(key, max, window, body => supabase<boolean>('/rest/v1/rpc/consume_request_quota', { method: 'POST', admin: true, body }))
  }
  if (!import.meta.dev) throw createError({ statusCode: 503, statusMessage: 'Request protection is not configured. Add the server Supabase key and apply the security migrations.' })
  const now = Date.now()
  for (const [k,v] of buckets) if (v.reset <= now) buckets.delete(k)
  const bucket = buckets.get(key)
  if (!bucket) {
    if (buckets.size >= 10000) throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please wait and try again.' })
    buckets.set(key, { count: 1, reset: now + window }); return
  }
  if (++bucket.count > max) throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please wait and try again.' })
}
