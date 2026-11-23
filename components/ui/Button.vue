<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'default' | 'outline' | 'ghost'; type?: 'button' | 'submit'; disabled?: boolean }>(), { variant: 'default', type: 'button', disabled: false })
</script>
<template><button :type="type" :disabled="disabled" :class="['ui-button', `ui-button--${variant}`]"><slot /></button></template>
