<script setup lang="ts">
const config = await useRequestFetch()('/api/config')
if (config.cloud) await navigateTo('/login')
useHead({ title: 'Connect your business workspace · QuoteFollow PH' })
</script>
<template>
  <main class="auth-shell">
    <div class="brand"><span class="brand-mark"><AppIcon name="check" /></span>QuoteFollow PH</div>
    <section class="panel auth-card">
      <span class="eyebrow">CONNECT YOUR WORKSPACE</span>
      <h1>Set up your database</h1>
      <p class="helper">Connect Supabase to create your account and save your business records.</p>
      <ol class="setup-steps">
        <li>Create a Supabase project.</li>
        <li>Run all SQL migrations from <code>supabase/migrations/</code> in order.</li>
        <li>Copy <code>.env.example</code> to <code>.env</code> and set your Supabase URL and anon key.</li>
        <li>Configure the confirmation and password-reset email templates using <code>SETUP.md</code>.</li>
        <li>Restart the app, then create your account.</li>
      </ol>
      <p class="helper">Keep your keys in the server environment. No customer records are stored in this browser.</p>
      <NuxtLink to="/login" class="ui-button ui-button--default">Continue to sign in</NuxtLink>
    </section>
  </main>
</template>
