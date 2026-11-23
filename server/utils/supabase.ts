import type { H3Event } from 'h3'
export function configured() { const c = useRuntimeConfig(); return Boolean(c.supabaseUrl && c.supabaseAnonKey) }
export async function supabase<T = any>(path: string, options: { method?: string; body?: unknown; token?: string; admin?: boolean; headers?: Record<string,string> } = {}): Promise<T> {
  const c = useRuntimeConfig()
  const key = options.admin ? c.supabaseServiceKey : c.supabaseAnonKey
  if (!configured() || !key) throw createError({ statusCode: 503, statusMessage: 'Cloud service is not configured' })
  const authorization = options.token || (String(key).startsWith('eyJ') ? String(key) : '')
  try {
    return await $fetch<T>(`${String(c.supabaseUrl).replace(/\/$/, '')}${path}`, {
      method: (options.method || 'GET') as any, body: options.body as any, timeout: 15000,
      headers: { apikey: String(key), ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}), ...options.headers },
    })
  } catch (error: any) {
    const status = error.statusCode || error.status
    // Do not return provider responses, keys, or account existence to the browser.
    if (!status) throw createError({ statusCode: 503, statusMessage: 'Cloud service is unreachable. Check the Supabase project status and project URL.' })
    if (status === 401 || status === 403) throw createError({ statusCode: 401, statusMessage: 'Session expired or access denied' })
    if (status === 409 || error.data?.code === '40001') throw createError({ statusCode: 409, statusMessage: 'Workspace changed. Reload before saving again.' })
    throw createError({ statusCode: status === 429 ? 429 : 502, statusMessage: status === 429 ? 'Too many requests. Try again later.' : 'Cloud operation failed. Check configuration and try again.' })
  }
}
export interface Session { access_token: string; refresh_token: string; expires_in: number; user?: { id: string; email: string } }
export function saveSession(event: H3Event, session: Session) {
  const secure = String(useRuntimeConfig().appUrl).startsWith('https:')
  const options = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' }
  setCookie(event, 'qf-access', session.access_token, { ...options, maxAge: session.expires_in || 3600 })
  setCookie(event, 'qf-refresh', session.refresh_token, { ...options, maxAge: 60 * 60 * 24 * 30 })
}
export function clearAuthCookies(event: H3Event) { deleteCookie(event, 'qf-access', { path: '/' }); deleteCookie(event, 'qf-refresh', { path: '/' }) }
export async function requireUser(event: H3Event) {
  let token = getCookie(event, 'qf-access')
  if (token || getCookie(event, 'qf-refresh')) await rateLimit(`session:${clientAddress(event)}`, 120)
  let user: { id: string; email: string } | undefined
  if (token) { try { user = await supabase('/auth/v1/user', { token }) } catch (error: any) { if (error.statusCode !== 401) throw error } }
  if (!user) {
    const refresh = getCookie(event, 'qf-refresh')
    if (!refresh) throw createError({ statusCode: 401, statusMessage: 'Sign in to continue' })
    try {
      const session = await supabase<Session>('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refresh } })
      saveSession(event, session); token = session.access_token
      user = await supabase('/auth/v1/user', { token })
    } catch { clearAuthCookies(event); throw createError({ statusCode: 401, statusMessage: 'Please sign in again' }) }
  }
  if (!user || !token) throw createError({ statusCode: 401, statusMessage: 'Sign in to continue' })
  return { user, token }
}
