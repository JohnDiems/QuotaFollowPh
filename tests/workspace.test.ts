import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyWorkspace, validateWorkspace, assertQuoteTransitions } from '../utils/workspace.ts'
function fixture() {
  const w = emptyWorkspace()
  w.customers.push({ id: 'c1', name: 'Sample', email: '', phone: '', company: '', address: '' })
  w.quotes.push({ id: 'QF-1001', customerId: 'c1', title: 'Cleaning', status: 'Sent', created: '2026-11-11', expires: '2026-11-25', followUp: '', items: [{ name: 'Cleaning', price: 50000, quantity: 1 }], discount: 0, tax: 0, notes: '' })
  return w
}
test('rejects invalid relationships, duplicate ids, dates and unsafe money', () => {
  validateWorkspace(fixture())
  for (const corrupt of [
    (w: ReturnType<typeof fixture>) => { w.quotes[0]!.customerId = 'someone-else' },
    (w: ReturnType<typeof fixture>) => { w.customers.push({ ...w.customers[0]! }) },
    (w: ReturnType<typeof fixture>) => { w.quotes[0]!.expires = '2026-02-31' },
    (w: ReturnType<typeof fixture>) => { w.quotes[0]!.items[0]!.price = 0.001 },
  ]) { const w = fixture(); corrupt(w); assert.throws(() => validateWorkspace(w)) }
})
test('sent quotes allow reminders and decisions but prevent silent content changes', () => {
  const before = fixture(), after = structuredClone(before)
  after.quotes[0]!.followUp = '2026-11-12'
  after.quotes[0]!.status = 'Accepted'
  assert.doesNotThrow(() => assertQuoteTransitions(before, after))
  after.quotes[0]!.items[0]!.price = 1
  assert.throws(() => assertQuoteTransitions(before, after), /immutable/)
  assert.throws(() => assertQuoteTransitions(before, { ...after, quotes: [] }))
})
test('completed quotes cannot return to sent or draft', () => {
  const before = fixture(); before.quotes[0]!.status = 'Accepted'
  const after = structuredClone(before); after.quotes[0]!.status = 'Sent'
  assert.throws(() => assertQuoteTransitions(before, after))
})
