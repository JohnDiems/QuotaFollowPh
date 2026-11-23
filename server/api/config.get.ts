export default defineEventHandler(() => {
  const c = useRuntimeConfig()
  return { cloud: configured(), ai: Boolean(c.openaiApiKey && c.openaiModel), billing: Boolean(c.paymongoSecretKey && c.paymongoWebhookSecret && c.supabaseServiceKey), email: c.mailProvider === 'gmail' ? Boolean(c.gmailUser && c.gmailAppPassword) : Boolean(c.resendApiKey && c.mailFrom), billingAmount: Number(c.billingAmount), billingRequired: String(c.billingRequired) === 'true' }
})
