<script setup lang="ts">
import PasswordField from '~/components/PasswordField.vue'
const route = useRoute(), password = ref(''), message = ref(''), busy = ref(false)
async function reset() {
  busy.value = true
  try { await $fetch('/api/auth/reset', { method: 'POST', body: { token_hash: route.query.token_hash, password: password.value } }); await navigateTo('/') }
  catch (e: any) { message.value = e.data?.statusMessage || 'Password reset failed. Request a new link.' }
  finally { busy.value = false }
}
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })
</script>
<template><main class="auth-shell"><section class="panel auth-card"><h1>Choose a new password</h1><form @submit.prevent="reset"><PasswordField id="reset-password" v-model="password" label="New password" new-password /><p v-if="message" class="form-error" role="alert">{{ message }}</p><UiButton type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save password' }}</UiButton></form><NuxtLink to="/login">Back to sign in</NuxtLink></section></main></template>
