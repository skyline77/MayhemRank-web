<script setup lang="ts">
withDefaults(defineProps<{ sticky?: boolean }>(), { sticky: false })
</script>
<template>
  <header class="build-detail-heading" :class="{ 'is-sticky': sticky }">
    <slot /><span v-if="sticky" class="detail-heading-bottom-shadow" aria-hidden="true"></span>
  </header>
</template>
