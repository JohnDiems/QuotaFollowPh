import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { createEvent } from 'h3'
import { ServerResponse } from 'node:http'
import { readLimitedRaw, readLimitedJson } from '../server/utils/requestBody.ts'
function request(body: string, headers: Record<string,string> = {}) {
  const req = new PassThrough() as any
  req.method = 'POST'; req.url = '/'; req.headers = headers
  const event = createEvent(req, new ServerResponse(req))
  return { event, send: () => req.end(body) }
}
test('rejects chunked oversized requests without trusting Content-Length', async () => {
  const r = request('a'.repeat(1025), { 'transfer-encoding': 'chunked' })
  const result = readLimitedRaw(r.event, 1024); r.send()
  await assert.rejects(result, (e: any) => e.statusCode === 413)
})
test('preserves exact webhook body bytes for signature verification', async () => {
  const raw = '{ "signed": true }\n'
  const r = request(raw); const result = readLimitedRaw(r.event); r.send()
  assert.equal(await result, raw)
})
test('JSON bodies must be objects and explicitly use JSON content type', async () => {
  for (const body of ['null','[]','invalid']) {
    const r=request(body, { 'content-type':'application/json' }); const result=readLimitedJson(r.event); r.send()
    await assert.rejects(result, (e:any)=>e.statusCode===400)
  }
  const r=request('{}', { 'content-type':'text/plain' })
  await assert.rejects(readLimitedJson(r.event), (e:any)=>e.statusCode===415)
  r.send()
})

import { enforceSharedQuota } from '../server/utils/rateLimit.ts'
test('shared quota adapter hashes identifiers and fails closed on backend outages', async () => {
  let received:any
  await enforceSharedQuota('auth:192.0.2.1',2,60000,async body=>{received=body;return true})
  assert.match(received.bucket_hash,/^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(received).includes('192.0.2.1'),false)
  await assert.rejects(enforceSharedQuota('test',2,60000,async()=>false),(e:any)=>e.statusCode===429)
  await assert.rejects(enforceSharedQuota('test',2,60000,async()=>{throw Error('secret upstream response')}),(e:any)=>e.statusCode===503 && !e.message.includes('secret'))
})
