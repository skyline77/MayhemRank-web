<script setup lang="ts">
defineProps<{ascending?:boolean}>()
</script>
<template>
 <svg class="sort-direction" :class="{'is-ascending':ascending}" aria-hidden="true" width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2v10M2 9l3 3 3-3" /></svg>
</template>
<style scoped>
.sort-direction{display:inline-block;transform:rotate(0deg);transform-origin:center;transition:transform 180ms ease-out}
.sort-direction.is-ascending{transform:rotate(180deg)}
@media(prefers-reduced-motion:reduce){.sort-direction{transition:none}}
</style>
