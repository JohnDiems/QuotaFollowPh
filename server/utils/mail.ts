import nodemailer from 'nodemailer'
import { createHash } from 'node:crypto'

export async function deliverMail(to: string, subject: string, text: string, idempotencyKey: string, context: { token: string } | { reminderOwner: string; reminderDay: string }) {
  const c = useRuntimeConfig()
  if (c.mailProvider === 'gmail' ? !c.gmailUser || !c.gmailAppPassword : c.mailProvider !== 'resend' || !c.resendApiKey || !c.mailFrom) {
    throw createError({ statusCode: 503, statusMessage: 'Email delivery is not configured' })
  }
  // Reserve once before contacting any provider. Keep the reservation on failures:
  // after a timeout, acceptance is uncertain and automatic retry could duplicate mail.
  const reserved = 'token' in context
    ? await supabase<boolean>('/rest/v1/rpc/reserve_quote_email', { method: 'POST', token: context.token, body: { secret_hash: idempotencyKey.slice('quote-'.length) } })
    : await supabase<boolean>('/rest/v1/rpc/reserve_reminder_email', { method: 'POST', admin: true, body: { owner_identifier: context.reminderOwner, reminder_day: context.reminderDay } })
  if (!reserved) throw createError({ statusCode: 409, statusMessage: 'This email was already attempted. Check delivery before trying again; repeated sends are blocked.' })
  if (c.mailProvider === 'gmail') {
    if (!c.gmailUser || !c.gmailAppPassword) throw createError({ statusCode: 503, statusMessage: 'Gmail delivery is not configured. Add the Gmail address and App Password.' })
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: String(c.gmailUser), pass: String(c.gmailAppPassword).replace(/\s/g, '') },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
      disableFileAccess: true, disableUrlAccess: true,
    })
    try {
      const result = await transport.sendMail({
        from: { name: 'QuoteFollow PH', address: String(c.gmailUser) }, to, subject, text,
        // Stable Message-ID identifies retries; SMTP does not guarantee deduplication.
        messageId: `<${createHash('sha256').update(idempotencyKey).digest('hex')}@${String(c.gmailUser).split('@')[1]}>`,
      })
      if (!result.accepted?.length) throw new Error('Recipient not accepted')
      return { id: result.messageId }
    } catch (error: any) {
      if (error.code === 'EAUTH') throw createError({ statusCode: 502, statusMessage: 'Gmail sign-in failed. Check the sender address, 2-Step Verification, and Google App Password.' })
      throw createError({ statusCode: 502, statusMessage: 'Gmail delivery failed. Check sending limits and the SMTP connection before retrying.' })
    } finally { transport.close() }
  }
  if (c.mailProvider !== 'resend') throw createError({ statusCode: 503, statusMessage: 'Choose a supported email provider: gmail or resend.' })
  if (!c.resendApiKey || !c.mailFrom) throw createError({ statusCode: 503, statusMessage: 'Email delivery is not configured' })
  try {
    return await $fetch<{ id: string }>('https://api.resend.com/emails', { method: 'POST', timeout: 15000,
      headers: { Authorization: `Bearer ${c.resendApiKey}`, 'Idempotency-Key': idempotencyKey },
      body: { from: c.mailFrom, to: [to], subject, text },
    })
  } catch { throw createError({ statusCode: 502, statusMessage: 'Email delivery failed. Please try again later.' }) }
}
