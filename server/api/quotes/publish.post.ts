import { randomBytes, createHash } from 'node:crypto'
export default defineEventHandler(async event => {
  const { token, user } = await requireUser(event)
  await rateLimit(`publish:${user.id}`, 20)
  await requireEntitlement(token)
  const { quoteId } = await readLimitedJson(event)
  if (typeof quoteId !== 'string' || quoteId.length > 100) throw createError({ statusCode: 400, statusMessage: 'Invalid quote' })
  const secret = randomBytes(32).toString('base64url')
  await supabase('/rest/v1/rpc/publish_quote', { method: 'POST', token, body: { quote_identifier: quoteId, secret_hash: createHash('sha256').update(secret).digest('hex') } })
  return { url: `${String(useRuntimeConfig().appUrl).replace(/\/$/,'')}/q/${secret}` }
})
