import { timingSafeEqual } from 'node:crypto'
import { today } from '~/utils/quotes'
export default defineEventHandler(async event => {
  const c = useRuntimeConfig(), expected = `Bearer ${c.cronSecret}`, supplied = getHeader(event, 'authorization') || ''
  if (!c.cronSecret || expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))) throw createError({ statusCode: 401 })
  const jobs = await supabase<any[]>('/rest/v1/rpc/due_reminders', { method: 'POST', admin: true, body: {} })
  let sent = 0, failed = 0
  for (const job of jobs) {
    try { await deliverMail(job.email, `Your QuoteFollow reminders for ${today()}`, `You have ${job.quotes.length} quote follow-ups due.\n\n${job.quotes.map((q: any) => `${q.id}: ${q.title}`).join('\n')}\n\nOpen your workspace: ${c.appUrl}\n\nThis reminder was sent to you, not to your customers.`, `reminders-${job.owner_id}-${today()}`, { reminderOwner: job.owner_id, reminderDay: today() }); sent++ }
    catch { failed++ }
  }
  return { sent, failed, limit: 100 }
})
