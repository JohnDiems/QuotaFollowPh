import { emptyWorkspace } from '~/utils/workspace'
export default defineEventHandler(async event => {
  const { token } = await requireUser(event)
  const rows = await supabase<any[]>('/rest/v1/workspaces?select=payload,version', { token })
  return rows[0] || { payload: emptyWorkspace(), version: 0 }
})
