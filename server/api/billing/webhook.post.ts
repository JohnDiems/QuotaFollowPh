import { verifyPaymongoSignature } from '../../utils/paymongoSignature'
export default defineEventHandler(async event => {
  const c = useRuntimeConfig()
  if (!c.paymongoWebhookSecret || !c.paymongoSecretKey) throw createError({ statusCode: 503 })
  const raw = await readLimitedRaw(event, 200_000)
  if (raw.length > 200_000) throw createError({ statusCode: 413 })
  const live = String(c.paymongoSecretKey).startsWith('sk_live_')
  if (!verifyPaymongoSignature(raw, getHeader(event, 'paymongo-signature') || '', String(c.paymongoWebhookSecret), live)) throw createError({ statusCode: 401, statusMessage: 'Invalid signature' })
  let payload: any
  try { payload = JSON.parse(raw) } catch { throw createError({ statusCode: 400 }) }
  const notification = payload?.data
  if (notification?.attributes?.type !== 'checkout_session.payment.paid') return { received: true }
  if (notification.attributes.livemode !== live) throw createError({ statusCode: 400, statusMessage: 'Payment mode mismatch' })
  const sessionId = notification.attributes.data?.id
  if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9]+$/.test(sessionId)) throw createError({ statusCode: 400 })
  // Retrieve the provider's current session; never trust browser redirects for fulfillment.
  const receipt = await $fetch<any>(`https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(sessionId)}`, { timeout: 15000, headers: { Authorization: `Basic ${Buffer.from(`${c.paymongoSecretKey}:`).toString('base64')}` } })
  const attrs = receipt.data.attributes
  const payment = attrs.payments?.find((p: any) => p.attributes?.status === 'paid')
  if (attrs.livemode !== live || !payment || payment.attributes.currency !== 'PHP') throw createError({ statusCode: 400, statusMessage: 'Payment is not confirmed' })
  const order = attrs.reference_number
  if (typeof order !== 'string' || !/^[a-f0-9-]{36}$/i.test(order)) throw createError({ statusCode: 400 })
  await supabase('/rest/v1/rpc/fulfill_order', { method: 'POST', admin: true, body: { order_identifier: order, checkout_identifier: sessionId, paid_amount: payment.attributes.amount, event_identifier: notification.id } })
  return { received: true }
})
