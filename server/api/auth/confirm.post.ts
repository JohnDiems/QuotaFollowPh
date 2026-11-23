export default defineEventHandler(async event => {
  const body = await readLimitedJson(event)
  if (typeof body?.token_hash !== 'string' || body.token_hash.length > 500) throw createError({ statusCode: 400, statusMessage: 'Invalid confirmation link' })
  await rateLimit(`confirm:${clientAddress(event)}`, 10)
  const session = await supabase<Session>('/auth/v1/verify', { method: 'POST', body: { token_hash: body.token_hash, type: 'email' } })
  saveSession(event, session)
  return { ok: true }
})
