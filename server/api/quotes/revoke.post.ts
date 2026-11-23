export default defineEventHandler(async event => {
  const { token } = await requireUser(event)
  const { quoteId } = await readLimitedJson(event)
  if (typeof quoteId !== 'string' || quoteId.length > 100) throw createError({ statusCode: 400 })
  await supabase('/rest/v1/rpc/revoke_quote', { method: 'POST', token, body: { quote_identifier: quoteId } })
  return { ok: true }
})
