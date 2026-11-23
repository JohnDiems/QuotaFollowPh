<script setup lang="ts">
import { money } from '~/utils/quotes'
const { data: config } = await useFetch('/api/config')
const subscription = ref<any>(null), events = ref<any[]>([]), testMode = ref(false), busy = ref(false), feedback = ref('')
async function refreshStatus() {
  busy.value = true
  try {
    const result = await $fetch('/api/billing/status'); subscription.value = result.subscription; testMode.value = result.testMode
    events.value = await $fetch<any[]>('/api/quotes/events')
  } catch (e: any) { feedback.value = e.data?.statusMessage || 'Unable to load cloud status.' }
  finally { busy.value = false }
}
async function checkout() {
  busy.value = true
  try { const result = await $fetch('/api/billing/checkout', { method: 'POST' }); window.location.assign(result.url) }
  catch (e: any) { feedback.value = e.data?.statusMessage || 'Checkout failed.'; busy.value = false }
}
</script>
<template><section class="panel settings-panel"><div class="panel-heading"><div><h2>Integrations & subscription</h2><p>Manage the services connected to your business account.</p></div></div><div class="settings-form"><ul class="integration-status"><li>Cloud accounts <strong>{{ config?.cloud ? 'Configured' : 'Not configured' }}</strong></li><li>AI drafting <strong>{{ config?.ai ? 'Configured' : 'Not configured' }}</strong></li><li>Email delivery <strong>{{ config?.email ? 'Configured' : 'Not configured' }}</strong></li><li>PayMongo checkout <strong>{{ config?.billing ? 'Configured' : 'Not configured' }}</strong></li></ul><UiButton variant="outline" :disabled="busy" @click="refreshStatus">Refresh subscription & activity</UiButton><p v-if="subscription" class="notice">{{ subscription.status === 'trialing' ? 'Trial' : 'Paid access' }} until {{ new Date(subscription.period_end).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) }}. {{ testMode ? 'PayMongo test mode: no real payments.' : '' }}</p><p class="helper">{{ config?.billingRequired ? 'An active trial or paid period is required for publishing, AI, and email.' : 'Billing enforcement is currently disabled.' }}</p><p class="helper">{{ money(config?.billingAmount || 49900) }} for one month. Manual renewal; no automatic debit or cancellation fees.</p><UiButton :disabled="busy || !config?.billing" @click="checkout">{{ busy ? 'Please wait…' : 'Purchase / renew one month' }}</UiButton><p class="helper">Payment redirects do not grant access. Your subscription updates after a verified payment notification.</p><h3 class="activity-heading">Recent customer-link activity</h3><ul class="activity-list"><li v-for="(item,i) in events" :key="i"><strong>{{ item.quote_id }} · {{ item.event }}</strong><small>{{ item.actor_name }} · {{ new Date(item.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) }}</small></li></ul><p v-if="!events.length" class="helper">Refresh to load activity. Published links and customer decisions will appear here.</p><p v-if="feedback" class="notice" role="status">{{ feedback }}</p></div></section></template>
