export default defineNitroPlugin(nitro => {
  nitro.hooks.hook('render:html', (html, { event }) => {
    const nonce = event.context.cspNonce
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(nonce)) return
    // Nuxt-rendered markup only. User fields use escaped Vue interpolation, never v-html.
    const stamp = (fragment: string) => fragment.replace(/<script(?=[\s>])([^>]*)>/gi, (_, attributes: string) =>
      `<script nonce="${nonce}"${attributes.replace(/\snonce\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')}>`)
    for (const section of ['head', 'body', 'bodyAppend', 'bodyPrepend'] as const) {
      html[section] = html[section].map(stamp)
    }
  })
})
