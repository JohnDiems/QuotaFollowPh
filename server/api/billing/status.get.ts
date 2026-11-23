export default defineEventHandler(async event => {
  const { token } = await requireUser(event)
  const rows = await supabase<any[]>('/rest/v1/subscriptions?select=status,period_end', { token })
  return { subscription: (rows[0] || null) as { status: string; period_end: string } | null, testMode: String(useRuntimeConfig().paymongoSecretKey).startsWith('sk_test_') }
})
