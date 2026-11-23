<script setup lang="ts">
const route = useRoute()
const message = ref('Confirm your email to open your workspace.'), busy = ref(false)
async function confirm() {
  busy.value = true
  try { await $fetch('/api/auth/confirm', { method: 'POST', body: { token_hash: route.query.token_hash } }); await navigateTo('/') }
  catch (e: any) { message.value = e.data?.statusMessage || 'Confirmation failed. Request another email.' }
  finally { busy.value = false }
}
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })
</script>
<template><main class="auth-shell"><section class="panel auth-card"><h1>Confirm your account</h1><p class="notice">{{ message }}</p><UiButton :disabled="busy" @click="confirm">{{ busy ? 'Confirming…' : 'Confirm email' }}</UiButton><NuxtLink to="/login">Back to sign in</NuxtLink></section></main></template>
