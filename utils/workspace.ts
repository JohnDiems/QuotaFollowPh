import type { Customer, Quote, Service } from './quotes.ts'
import { totals } from './quotes.ts'
export interface Workspace {
  business: { name: string; owner: string; email: string; phone: string; address: string; terms?: string; emailReminders?: boolean }
  customers: Customer[]; services: Service[]; quotes: Quote[]
}
export const emptyWorkspace = (): Workspace => ({ business: { name: '', owner: '', email: '', phone: '', address: '', terms: '' }, customers: [], services: [], quotes: [] })
const string = (x: unknown, max = 500): x is string => typeof x === 'string' && x.length <= max
const validDate = (x: unknown) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x
export function validateWorkspace(value: unknown): asserts value is Workspace {
  const w = value as Workspace
  if (!w || typeof w !== 'object' || !w.business) throw new Error('Missing business profile')
  for (const k of ['name', 'owner', 'email', 'phone', 'address'] as const) if (!string(w.business[k])) throw new Error('Invalid business profile')
  if (w.business.emailReminders !== undefined && typeof w.business.emailReminders !== 'boolean') throw new Error('Invalid email reminder preference')
  if (w.business.terms !== undefined && !string(w.business.terms, 5000)) throw new Error('Invalid terms')
  for (const k of ['customers','services','quotes'] as const) {
    if (!Array.isArray(w[k]) || w[k].length > 5000) throw new Error('Workspace record limit exceeded')
    const ids = w[k].map(item => item?.id)
    if (ids.some(id => !string(id, 100) || !id) || new Set(ids).size !== ids.length) throw new Error('Invalid or duplicate record identifiers')
  }
  for (const c of w.customers) for (const k of ['name','company','email','phone','address'] as const) if (!string(c[k])) throw new Error('Invalid customer')
  for (const s of w.services) if (!string(s.name) || !string(s.unit, 30) || !Number.isSafeInteger(s.price) || s.price < 0) throw new Error('Invalid service rate')
  for (const q of w.quotes) {
    if (!string(q.title, 120) || !q.title.trim() || !string(q.notes, 5000) || !string(q.customerId, 100) || !w.customers.some(c => c.id === q.customerId)) throw new Error('Invalid quote customer or description')
    if (!['Draft','Sent','Accepted','Declined','Expired'].includes(q.status)) throw new Error('Invalid quote status')
    if (!validDate(q.created) || !validDate(q.expires) || (q.followUp !== '' && !validDate(q.followUp))) throw new Error('Invalid quote date')
    if (!Array.isArray(q.items) || !q.items.length || q.items.length > 100 || q.items.some(i => !string(i.name) || !i.name.trim())) throw new Error('Invalid quote services')
    if (!Number.isSafeInteger(q.discount)) throw new Error('Invalid discount')
    totals(q.items, q.discount, q.tax)
  }
}
export function assertQuoteTransitions(before: Workspace, after: Workspace) {
  for (const old of before.quotes) {
    if (old.status === 'Draft') continue
    const next = after.quotes.find(q => q.id === old.id)
    if (!next) throw new Error('Sent quotes cannot be deleted')
    const fields = ['id','customerId','title','created','expires','items','discount','tax','notes'] as const
    if (fields.some(k => JSON.stringify(old[k]) !== JSON.stringify(next[k]))) throw new Error('Sent quote details are immutable. Create a revision instead.')
    if (['Accepted','Declined','Expired'].includes(old.status) && next.status !== old.status) throw new Error('A completed quote cannot be reopened')
    if (next.status === 'Draft') throw new Error('A sent quote cannot return to draft')
  }
}
