import { createHmac, timingSafeEqual } from 'node:crypto'
export function verifyPaymongoSignature(raw: string, header: string, secret: string, live: boolean, now = Date.now()) {
  const fields = Object.fromEntries(header.split(',').map(x => x.trim().split('=')))
  const signature = fields[live ? 'li' : 'te'] || ''
  const timestamp = Number(fields.t)
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > 300 || !/^[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', secret).update(`${fields.t}.${raw}`).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}
