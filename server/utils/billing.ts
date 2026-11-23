export async function requireEntitlement(token: string) {
  const required = await supabase<boolean>('/rest/v1/rpc/billing_enforced', { method: 'POST', token, body: {} })
  const configuredRequired = String(useRuntimeConfig().billingRequired) === 'true'
  if (configuredRequired && !required) throw createError({ statusCode: 503, statusMessage: 'Billing enforcement must also be enabled in the database before paid features are activated.' })
  if (!required) return
  const rows = await supabase<any[]>('/rest/v1/subscriptions?select=status,period_end', { token })
  if (!rows[0] || Date.parse(rows[0].period_end) <= Date.now()) throw createError({ statusCode: 402, statusMessage: 'Your trial or paid period ended. Renew in Settings to publish quotes or use AI.' })
}
