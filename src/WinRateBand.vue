<script setup lang="ts">
import { computed } from 'vue'
import { winRateBandInk } from './winRateTable'
const props = defineProps<{
  lower: number
  upper: number
  row: number
  span: number
  stacked?: boolean
}>()
const ink = computed(() => winRateBandInk(props.lower, props.upper))
</script>
<template>
  <div
    class="board-axis board-range-label"
    :data-range="lower + ':' + upper"
    :style="{ gridRow: row + ' / span ' + span, '--range-ink': ink }"
    aria-hidden="true"
  >
    <b v-if="stacked" class="board-range-stacked"
      ><span>{{ lower }}</span
      ><span>-</span><span>{{ upper }}</span></b
    ><b v-else>{{ lower }}–{{ upper }}<small>%</small></b>
  </div>
</template>
