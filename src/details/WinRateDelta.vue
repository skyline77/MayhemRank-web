<script setup lang="ts">
import { winRateDelta } from './buildDetails'
import { winRateColor } from '@/stats/winRateColor'
defineProps<{ winRate: number; baseline: number }>()
</script>
<template>
  <span class="win-rate-delta" :style="{ color: winRateColor(winRate - baseline, 0) }">{{
    winRateDelta(winRate, baseline)
  }}</span>
</template>
