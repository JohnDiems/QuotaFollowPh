import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyPaymongoSignature } from '../server/utils/paymongoSignature.ts'
test('validates the raw body, payment mode, timestamp and signature', () => {
  const raw = '{"data":{"id":"evt_test"}}', secret = 'test-webhook-secret', timestamp = 1800000000
  const signature = createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex')
  const header = `t=${timestamp},te=${signature},li=`
  assert.equal(verifyPaymongoSignature(raw,header,secret,false,timestamp*1000),true)
  assert.equal(verifyPaymongoSignature(raw+' ',header,secret,false,timestamp*1000),false)
  assert.equal(verifyPaymongoSignature(raw,header,secret,true,timestamp*1000),false)
  assert.equal(verifyPaymongoSignature(raw,header,secret,false,(timestamp+301)*1000),false)
  assert.equal(verifyPaymongoSignature(raw,'t=NaN,te=oops',secret,false,timestamp*1000),false)
})
