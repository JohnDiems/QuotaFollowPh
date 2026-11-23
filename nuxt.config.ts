export default defineNuxtConfig({
  srcDir: '.',
  compatibilityDate: '2026-01-01',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  postcss: { plugins: { 'tailwindcss/nesting': false } },
  css: ['~/assets/css/main.css'],
  app: { head: {
    title: 'QuoteFollow PH · Less admin. More booked jobs.',
    meta: [{ name: 'description', content: 'Create cleaning quotations and keep every follow-up in view.' }],
    link: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
  } },
  typescript: { strict: true },
  runtimeConfig: {
    supabaseUrl: '', supabaseAnonKey: '', supabaseServiceKey: '',
    appUrl: 'http://localhost:3000',
    openaiApiKey: '', openaiModel: '',
    paymongoSecretKey: '', paymongoWebhookSecret: '',
    billingAmount: 49900, billingRequired: false,
    resendApiKey: '', mailFrom: '', cronSecret: '',
    mailProvider: 'resend', gmailUser: '', gmailAppPassword: '',
  },
})
