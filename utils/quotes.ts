export type Status = 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired'
export interface Customer { id: string; name: string; company: string; email: string; phone: string; address: string }
export interface Service { id: string; name: string; unit: string; price: number }
export interface Line { name: string; quantity: number; price: number }
export interface Quote { id: string; customerId: string; title: string; status: Status; created: string; expires: string; followUp: string; items: Line[]; discount: number; tax: number; notes: string }
export function totals(items: Line[], discount = 0, tax = 0) {
  if (!Number.isFinite(discount) || discount < 0 || !Number.isFinite(tax) || tax < 0 || tax > 100) throw new Error('Invalid discount or tax')
  const subtotal = items.reduce((sum, item) => {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(item.price) || item.price < 0) throw new Error('Invalid quantity or price')
    return sum + Math.round(item.quantity * item.price)
  }, 0)
  if (!Number.isSafeInteger(subtotal)) throw new Error('Quote amount is too large')
  const deduction = Math.min(Math.round(discount), subtotal)
  const taxAmount = Math.round((subtotal - deduction) * tax / 100)
  const total = subtotal - deduction + taxAmount
  if (!Number.isSafeInteger(total)) throw new Error('Quote amount is too large')
  return { subtotal, discount: deduction, taxAmount, total }
}
export const money = (centavos: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(centavos / 100)
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export function effectiveStatus(q: Quote, date = today()): Status { return q.status === 'Sent' && q.expires < date ? 'Expired' : q.status }
export function needsFollowUp(q: Quote, date = today()) { return effectiveStatus(q, date) === 'Sent' && !!q.followUp && q.followUp <= date }
