const env = process.env
const has = name => Boolean(env[name]?.trim())
const issues = []
const report = (label, ready, detail) => console.log(`${ready ? 'READY' : 'PENDING'}: ${label}${detail ? ` — ${detail}` : ''}`)
let origin
try { origin = new URL(env.NUXT_APP_URL || 'http://localhost:3000') } catch { issues.push('NUXT_APP_URL must be a valid URL') }
const publicOrigin = origin?.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin?.hostname)
report('Public URL', publicOrigin, publicOrigin ? origin.origin : 'local only; set the deployed HTTPS origin')
if (origin && (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password)) issues.push('NUXT_APP_URL must contain only the app origin')
const cloud = has('NUXT_SUPABASE_URL') && has('NUXT_SUPABASE_ANON_KEY')
report('Supabase credentials', cloud)
if (!cloud) issues.push('Supabase URL and anon key are required')
report('Production request protection', has('NUXT_SUPABASE_SERVICE_KEY'), 'server-only key plus migration 004 required')
if (publicOrigin && !has('NUXT_SUPABASE_SERVICE_KEY')) issues.push('Public deployment requires the server Supabase key for shared rate limits')
const provider = env.NUXT_MAIL_PROVIDER || 'resend'
const email = provider === 'gmail' ? has('NUXT_GMAIL_USER') && has('NUXT_GMAIL_APP_PASSWORD') : provider === 'resend' && has('NUXT_RESEND_API_KEY') && has('NUXT_MAIL_FROM')
report('Email environment', email, provider)
if (!['gmail','resend'].includes(provider)) issues.push('NUXT_MAIL_PROVIDER must be gmail or resend')
if (provider === 'resend' && env.NUXT_MAIL_FROM?.includes('onboarding@resend.dev')) report('Customer email sender', false, 'test sender; verify an owned domain for customer delivery')
report('AI environment', has('NUXT_OPENAI_API_KEY') && has('NUXT_OPENAI_MODEL'), 'optional; credentials do not verify available credits')
const billing = has('NUXT_PAYMONGO_SECRET_KEY') && has('NUXT_PAYMONGO_WEBHOOK_SECRET') && has('NUXT_SUPABASE_SERVICE_KEY')
report('Payment environment', billing, has('NUXT_PAYMONGO_SECRET_KEY') ? env.NUXT_PAYMONGO_SECRET_KEY.startsWith('sk_test_') ? 'test mode' : 'check key mode' : 'optional')
if (env.NUXT_BILLING_REQUIRED === 'true' && !billing) issues.push('Billing enforcement is on but payment credentials are incomplete')
const amount = Number(env.NUXT_BILLING_AMOUNT || 49900)
if (!Number.isSafeInteger(amount) || amount < 2000) issues.push('Billing amount must be at least 2000 centavos')
report('Reminder environment', email && has('NUXT_SUPABASE_SERVICE_KEY') && has('NUXT_CRON_SECRET'), 'scheduler must also be configured separately')
console.log('Environment checks only: provider delivery, database migrations, auth settings, and checkout require live verification. No secrets displayed.')
for (const issue of issues) console.error(`ERROR: ${issue}`)
process.exitCode = issues.length ? 1 : 0
