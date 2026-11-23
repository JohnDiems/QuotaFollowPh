import { test } from 'node:test'
import assert from 'node:assert/strict'
import { totals, effectiveStatus, needsFollowUp, type Quote } from '../utils/quotes.ts'
test('calculates rounded centavos, discount, then tax', () => {
  assert.deepEqual(totals([{ name: 'Cleaning', quantity: 2.5, price: 10001 }], 1000, 12), { subtotal: 25003, discount: 1000, taxAmount: 2880, total: 26883 })
})
test('caps discounts and rejects unsafe amounts', () => {
  assert.equal(totals([{ name: 'Job', quantity: 1, price: 500 }], 900).total, 0)
  assert.throws(() => totals([{ name: 'Job', quantity: -1, price: 500 }]))
  assert.throws(() => totals([{ name: 'Job', quantity: 1, price: NaN }]))
  assert.throws(() => totals([], 0, 101))
})
test('expired and terminal quotes do not create follow-up tasks', () => {
  const q = { status: 'Sent', expires: '2026-11-20', followUp: '2026-11-10' } as Quote
  assert.equal(needsFollowUp(q, '2026-11-11'), true)
  assert.equal(effectiveStatus(q, '2026-11-21'), 'Expired')
  assert.equal(needsFollowUp(q, '2026-11-21'), false)
  for (const status of ['Accepted', 'Declined', 'Draft'] as const) assert.equal(needsFollowUp({ ...q, status }, '2026-11-11'), false)
})
