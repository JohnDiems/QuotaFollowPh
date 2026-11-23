export default defineEventHandler(async event => {
  const action = getRouterParam(event, 'action')
  if (action === 'logout') {
    const token = getCookie(event, 'qf-access')
    try { await rateLimit(`auth:${clientAddress(event)}`, 15); if (token) await supabase('/auth/v1/logout', { method: 'POST', token }) } catch {} finally { clearAuthCookies(event) }
    return { ok: true }
  }
  await rateLimit(`auth:${clientAddress(event)}`, 15)
  const body = await readLimitedJson(event)
  if (action === 'reset') {
    if (typeof body?.token_hash !== 'string' || body.token_hash.length > 500 || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw createError({ statusCode: 400, statusMessage: 'Use a valid recovery link and a password with 12–128 characters' })
    const session = await supabase<Session>('/auth/v1/verify', { method: 'POST', body: { token_hash: body.token_hash, type: 'recovery' } })
    await supabase('/auth/v1/user', { method: 'PUT', token: session.access_token, body: { password: body.password } })
    saveSession(event, session); return { ok: true }
  }
  if (typeof body?.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw createError({ statusCode: 400, statusMessage: 'Enter a valid email address' })
  const email = body.email.trim().toLowerCase()
  if (action === 'recover') {
    try { await supabase('/auth/v1/recover', { method: 'POST', body: { email } }) }
    catch (error: any) { if ([503, 429].includes(error.statusCode)) throw error }
    return { message: 'If an account exists, a password-reset email will arrive shortly.' }
  }
  if (!['login','signup'].includes(action || '')) throw createError({ statusCode: 404 })
  if (typeof body.password !== 'string' || body.password.length < (action === 'signup' ? 12 : 1) || body.password.length > 128) throw createError({ statusCode: 400, statusMessage: 'Use a password with 12–128 characters for a new account' })
  try {
    const session = await supabase<Session>(action === 'login' ? '/auth/v1/token?grant_type=password' : '/auth/v1/signup', { method: 'POST', body: { email, password: body.password } })
    if (session.access_token && session.refresh_token) { saveSession(event, session); return { ok: true } }
    return { message: 'Check your email to confirm your account, then sign in.' }
  } catch (error: any) {
    if ([503, 429].includes(error.statusCode)) throw error
    throw createError({ statusCode: 400, statusMessage: action === 'login' ? 'Unable to sign in. Check your credentials and email confirmation.' : 'Unable to create account. Check your details or try signing in.' }) }
})
