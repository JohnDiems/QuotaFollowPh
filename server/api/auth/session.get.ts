export default defineEventHandler(async event => {
  if (!configured()) return { user: null, cloud: false }
  try { const { user } = await requireUser(event); return { user: { id: user.id, email: user.email }, cloud: true } }
  catch (e: any) { if (e.statusCode === 401) return { user: null, cloud: true }; throw e }
})
