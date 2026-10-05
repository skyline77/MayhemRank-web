<script setup lang="ts">
import { t } from '@/i18n/i18n'
import { updateDate } from '@/data/versions'
import { formatCount } from '@/stats/formatCount'

defineProps<{ updatedAt: string; games: number }>()
</script>

<template>
  <p class="board-updated">
    {{ t('数据更新于') }}{{ updateDate(updatedAt) }}{{ t('，共') }}{{ formatCount(games)
    }}{{ t('场。') }}
  </p>
</template>
