import { randomUUID } from 'node:crypto'
export default defineEventHandler(async event => {
  const { user } = await requireUser(event)
  await rateLimit(`checkout:${user.id}`, 5, 60_000)
  const c = useRuntimeConfig()
  if (!c.paymongoSecretKey || !c.paymongoWebhookSecret || !c.supabaseServiceKey) throw createError({ statusCode: 503, statusMessage: 'Billing is not configured' })
  const amount = Number(c.billingAmount)
  if (!Number.isSafeInteger(amount) || amount < 2000) throw createError({ statusCode: 503, statusMessage: 'Invalid billing plan configuration' })
  const id = randomUUID()
  await supabase('/rest/v1/billing_orders', { method: 'POST', admin: true, body: { id, owner_id: user.id, amount } })
  try {
    const response = await $fetch<any>('https://api.paymongo.com/v2/checkout_sessions', {
      method: 'POST', timeout: 15000,
      headers: { Authorization: `Basic ${Buffer.from(`${c.paymongoSecretKey}:`).toString('base64')}` },
      body: { data: { attributes: { line_items: [{ name: 'QuoteFollow PH · One month of access (manual renewal)', amount, currency: 'PHP', quantity: 1 }], payment_method_types: ['qrph'], reference_number: id, success_url: `${c.appUrl}/?billing=success`, cancel_url: `${c.appUrl}/?billing=cancelled` } } },
    })
    await supabase(`/rest/v1/billing_orders?id=eq.${id}`, { method: 'PATCH', admin: true, body: { session_id: response.data.id } })
    const url = new URL(response.data.attributes.checkout_url)
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.paymongo.com') throw new Error('Unexpected checkout URL')
    return { url: url.href }
  } catch { throw createError({ statusCode: 502, statusMessage: 'Unable to start checkout. Please try again.' }) }
})
