<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue: string; id: string; label?: string; newPassword?: boolean }>(), { label: 'Password', newPassword: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const visible = ref(false)
const capsLock = ref(false)
function updateCaps(event: KeyboardEvent) { capsLock.value = event.getModifierState('CapsLock') }
</script>
<template>
  <div class="password-field">
    <label :for="id">{{ label }}</label>
    <div class="password-input">
      <input :id="id" :value="modelValue" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        :type="visible ? 'text' : 'password'" :autocomplete="newPassword ? 'new-password' : 'current-password'"
        :minlength="newPassword ? 12 : 1" maxlength="128" required autocapitalize="none" :spellcheck="false"
        :aria-describedby="newPassword || capsLock ? id + '-help' : undefined"
        @keydown="updateCaps" @keyup="updateCaps" @blur="capsLock = false">
      <button type="button" class="password-toggle" :aria-controls="id" :aria-pressed="visible"
        :aria-label="visible ? 'Hide password' : 'Show password'" @click="visible = !visible">
        {{ visible ? 'Hide' : 'Show' }}
      </button>
    </div>
    <div :id="id + '-help'" class="password-help">
      <p v-if="newPassword" :class="{ 'password-ready': modelValue.length >= 12 }">
        {{ modelValue.length >= 12 ? '✓ Minimum length met' : 'Use at least 12 characters' }} · {{ modelValue.length }}/128
      </p>
      <p v-if="newPassword" >A longer, unique passphrase is a good choice.</p>
      <p v-if="capsLock" class="password-caps" role="status">Caps Lock is on.</p>
    </div>
  </div>
</template>
<style scoped>
.password-field { display: grid; gap: 8px; }
.password-input { position: relative; }
.password-input input { padding-right: 78px; }
.password-toggle { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); min-height: 36px; padding: 6px 12px; border-radius: 5px; color: #137c5b; font-size: 14px; font-weight: 600; }
.password-toggle:hover { background: #eaf4ef; }
.password-help { color: #65776d; font-size: 13px; line-height: 1.6; }
.password-help:empty { display: none; }
.password-ready { color: #137c5b; }
.password-caps { color: #93631c; }
</style>
