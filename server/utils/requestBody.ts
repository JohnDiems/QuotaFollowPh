import type { H3Event } from 'h3'
import { createError, getHeader } from 'h3'

export async function readLimitedRaw(event: H3Event, limit = 2_000_000): Promise<string> {
  if (Number(getHeader(event, 'content-length') || 0) > limit) throw createError({ statusCode: 413, statusMessage: 'Request too large' })
  const request = event.node.req
  const supplied = (request as any).rawBody ?? (request as any).body
  if (supplied !== undefined) {
    const bytes = Buffer.isBuffer(supplied) ? supplied : Buffer.from(typeof supplied === 'string' ? supplied : JSON.stringify(supplied))
    if (bytes.length > limit) throw createError({ statusCode: 413, statusMessage: 'Request too large' })
    return bytes.toString('utf8')
  }
  return new Promise((resolve, reject) => {
    let chunks: Buffer[] = [], size = 0, failed = false
    const cleanup = () => { clearTimeout(timer); request.off('data', data); request.off('end', end); request.off('error', error); request.off('aborted', aborted) }
    const error = (cause: Error) => { cleanup(); chunks = []; reject(cause) }
    const fail = (statusCode: number, statusMessage: string) => {
      if (failed) return
      failed = true; chunks = []; cleanup()
      if (!event.node.res.headersSent) event.node.res.setHeader('Connection', 'close')
      event.node.res.once('finish', () => request.destroy())
      request.resume()
      reject(createError({ statusCode, statusMessage }))
    }
    const aborted = () => error(createError({ statusCode: 400, statusMessage: 'Request aborted' }))
    const data = (chunk: Buffer | string) => {
      if (failed) return
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > limit) { fail(413, 'Request too large'); return }
      chunks.push(bytes)
    }
    const end = () => { cleanup(); if (!failed) resolve(Buffer.concat(chunks).toString('utf8')) }
    const timer = setTimeout(() => fail(408, 'Request body timed out'), 15000)
    request.on('data', data); request.once('end', end); request.once('error', error); request.once('aborted', aborted)
    if (request.readableEnded) end()
  })
}
export async function readLimitedJson(event: H3Event): Promise<any> {
  const type = (getHeader(event, 'content-type') || '').split(';')[0]?.trim()
  if (type !== 'application/json') throw createError({ statusCode: 415, statusMessage: 'Use application/json' })
  const raw = await readLimitedRaw(event)
  try {
    const body = JSON.parse(raw)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Object required')
    return body
  } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid JSON object' }) }
}
