import { createHash } from 'node:crypto'
export default defineEventHandler(async event => {
  const token = getRouterParam(event, 'token') || ''
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw createError({ statusCode: 404, statusMessage: 'Quote unavailable' })
  await rateLimit(`public:${clientAddress(event)}`, 60)
  const result = await supabase('/rest/v1/rpc/read_shared_quote', { method: 'POST', body: { secret_hash: createHash('sha256').update(token).digest('hex') } })
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Quote unavailable or link revoked' })
  return result
})
