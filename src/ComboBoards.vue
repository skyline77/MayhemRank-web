<script setup lang="ts">
import { t, message } from './i18n'
import { ref } from 'vue'
import ComboBoard from './ComboBoard.vue'
import BoardModeSwitch from './BoardModeSwitch.vue'
const query = new URLSearchParams(location.search)
const active = ref<1 | 2>(
  query.get('runes') === '2' || (!query.has('runes') && location.hash === '#double-combos') ? 2 : 1,
)
const options = [
  { value: 1 as const, label: '英雄×海克斯', id: 'combo-mode-1', controls: 'combo-panel-1' },
  { value: 2 as const, label: '英雄×双海克斯', id: 'combo-mode-2', controls: 'combo-panel-2' },
]
function select(value: 1 | 2) {
  active.value = value
  const url = new URL(location.href)
  url.searchParams.set('runes', String(value))
  url.hash = ''
  history.replaceState(history.state, '', url.pathname + url.search)
}
</script>
<template>
  <div class="combo-content">
    <div :id="'combo-panel-' + active" role="region" :aria-labelledby="'combo-mode-' + active">
      <ComboBoard :rune-count="active">
        <template #filters>
          <BoardModeSwitch
            class="combo-mode"
            :model-value="active"
            :options="options"
            :label="t('组合榜单类型')"
            @update:model-value="select"
          />
        </template>
      </ComboBoard>
    </div>
  </div>
</template>
<style scoped>
.combo-content {
  width: 100%;
  max-width: 900px;
  min-width: 0;
  margin-inline: auto;
  padding-top: 0;
}
.combo-mode {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 100%;
}
.combo-mode :deep(button) {
  white-space: nowrap;
}
.combo-mode :deep(button[aria-pressed='true']) {
  box-shadow: none;
}
</style>
