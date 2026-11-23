import { createHash } from 'node:crypto'
import type { Workspace } from '~/utils/workspace'
export default defineEventHandler(async event => {
  const { token, user } = await requireUser(event)
  await requireEntitlement(token)
  await rateLimit(`email:${user.id}`, 10, 3600_000)
  const body = await readLimitedJson(event)
  if (typeof body?.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token) || typeof body.quoteId !== 'string' || body.confirmed !== true) throw createError({ statusCode: 400, statusMessage: 'Confirm the quote email before sending' })
  const hash = createHash('sha256').update(body.token).digest('hex')
  const valid = await supabase('/rest/v1/rpc/owner_share_matches', { method: 'POST', token, body: { quote_identifier: body.quoteId, secret_hash: hash } })
  if (!valid) throw createError({ statusCode: 404, statusMessage: 'Publish an open quote link first' })
  const rows = await supabase<{ payload: Workspace }[]>('/rest/v1/workspaces?select=payload', { token })
  const w = rows[0]?.payload, q = w?.quotes.find(q => q.id === body.quoteId), customer = w?.customers.find(c => c.id === q?.customerId)
  if (!customer?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw createError({ statusCode: 400, statusMessage: 'Add a valid customer email first' })
  const text = `Hello ${customer.name},\n\n${w!.business.name} has prepared quote ${q!.id} for ${q!.title}.\n\nReview and respond securely:\n${useRuntimeConfig().appUrl}/q/${body.token}\n\nPlease contact ${w!.business.email} with any questions.`
  await deliverMail(customer.email, `Your quote ${q!.id} from ${w!.business.name}`, text, `quote-${hash}`, { token })
  return { ok: true }
})
