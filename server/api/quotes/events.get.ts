export default defineEventHandler(async event => {
  const { token } = await requireUser(event)
  return supabase('/rest/v1/quote_events?select=quote_id,event,actor_name,created_at&order=created_at.desc&limit=50', { token })
})
