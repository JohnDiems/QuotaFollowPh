<script setup lang="ts">
import MarketingPage from '~/components/MarketingPage.vue'
const session = await useRequestFetch()('/api/auth/session')
useHead({ title: session.user ? 'Your workspace · QuoteFollow PH' : 'QuoteFollow PH · Cleaning quotes, customers & follow-ups', meta: [{ name: 'description', content: 'Prepare professional cleaning quotations, manage customers, and keep follow-ups in view. Built for Philippine cleaning businesses.' }] })
</script>
<template><WorkspaceDashboard v-if="session.cloud && session.user" /><MarketingPage v-else /></template>
