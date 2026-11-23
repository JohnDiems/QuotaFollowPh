import { validateWorkspace, assertQuoteTransitions } from '~/utils/workspace'
export default defineEventHandler(async event => {
  const { token } = await requireUser(event)
  const body = await readLimitedJson(event)
  try { validateWorkspace(body?.payload) } catch (e: any) { throw createError({ statusCode: 400, statusMessage: e.message }) }
  if (!Number.isSafeInteger(body.version) || body.version < 0) throw createError({ statusCode: 400, statusMessage: 'Invalid workspace version' })
  const old = await supabase<any[]>('/rest/v1/workspaces?select=payload,version', { token })
  if (old[0]) { try { assertQuoteTransitions(old[0].payload, body.payload) } catch (e: any) { throw createError({ statusCode: 400, statusMessage: e.message }) } }
  const version = await supabase<number>('/rest/v1/rpc/save_workspace', { method: 'POST', token, body: { document: body.payload, expected_version: body.version } })
  return { version }
})
