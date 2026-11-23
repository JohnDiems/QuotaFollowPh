import { createHash } from 'node:crypto'
export default defineEventHandler(async event => {
  const token = getRouterParam(event, 'token') || ''
  const body = await readLimitedJson(event)
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !['Accepted','Declined'].includes(body?.decision) || typeof body?.name !== 'string' || body.name.trim().length < 2 || body.name.length > 100 || body.confirmed !== true) throw createError({ statusCode: 400, statusMessage: 'Enter your name and confirm your response' })
  await rateLimit(`respond:${clientAddress(event)}`, 10)
  try { return await supabase('/rest/v1/rpc/respond_shared_quote', { method: 'POST', body: { secret_hash: createHash('sha256').update(token).digest('hex'), decision: body.decision, signed_name: body.name.trim() } }) }
  catch { throw createError({ statusCode: 409, statusMessage: 'This quote is no longer open. Refresh to see its current status.' }) }
})
