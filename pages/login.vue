<script setup lang="ts">
import PasswordField from '~/components/PasswordField.vue'
const request = useRequestFetch()
const config = await request('/api/config')
const mode = ref<'login' | 'signup' | 'recover'>(useRoute().query.mode === 'signup' ? 'signup' : 'login')
const email = ref(''), password = ref(''), busy = ref(false), message = ref(''), error = ref('')
watch(mode, () => { password.value = '' })
async function submit() {
  busy.value = true; message.value = ''; error.value = ''
  try {
    const result = await $fetch<{ ok?: boolean; message?: string }>(`/api/auth/${mode.value}`, { method: 'POST', body: { email: email.value, password: password.value } })
    if (result.ok) { clearNuxtState(['workspace', 'workspace-loaded', 'workspace-version', 'workspace-dirty']); await navigateTo('/') }
    else message.value = result.message || 'Check your inbox.'
  } catch (e: any) { error.value = e.data?.statusMessage || 'Unable to continue. Please try again.' }
  finally { busy.value = false }
}
</script>
<template><main class="auth-shell"><NuxtLink to="/" class="brand"><span class="brand-mark"><AppIcon name="check" /></span>QuoteFollow PH</NuxtLink><section class="panel auth-card"><span class="eyebrow">LESS ADMIN. MORE BOOKED JOBS.</span><h1>{{ mode === 'signup' ? 'Start your workspace' : mode === 'recover' ? 'Reset your password' : 'Welcome back' }}</h1><p class="helper">{{ config.cloud ? 'Your business records, securely saved in the cloud.' : 'Supabase must be configured before you can sign in.' }}</p><form v-if="config.cloud" @submit.prevent="submit"><label>Email<input v-model="email" type="email" autocomplete="email" required maxlength="254"></label><PasswordField v-if="mode !== 'recover'" :key="mode" id="account-password" v-model="password" :new-password="mode === 'signup'" /><p v-if="mode === 'signup'" class="helper">Confirm your email before signing in.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="message" class="notice" role="status">{{ message }}</p><UiButton type="submit" :disabled="busy">{{ busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'recover' ? 'Send reset email' : 'Sign in' }}</UiButton></form><div v-if="config.cloud" class="auth-links"><button @click="mode = mode === 'signup' ? 'login' : 'signup'; error = ''; message = ''">{{ mode === 'signup' ? 'Already registered? Sign in' : 'Create an account' }}</button><button @click="mode = mode === 'recover' ? 'login' : 'recover'; error = ''; message = ''">{{ mode === 'recover' ? 'Back to sign in' : 'Forgot password?' }}</button></div><NuxtLink v-else to="/setup" class="ui-button ui-button--default">View setup instructions</NuxtLink></section><NuxtLink to="/about" class="helper">Learn about QuoteFollow PH →</NuxtLink></main></template>
