<script setup lang="ts">
// UI 方案试用切换器：固定在右下角，只在试用分支中存在。
import { applySkin, skin, skins } from './skin'
</script>
<template>
  <div class="skin-switcher" role="group" aria-label="UI 方案">
    <button
      v-for="item in skins"
      :key="item.id"
      type="button"
      :aria-pressed="skin === item.id"
      @click="applySkin(item.id)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
<style scoped>
.skin-switcher {
  position: fixed;
  right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 50;
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(20, 20, 24, 0.86);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  font-size: 12px;
}
.skin-switcher button {
  padding: 6px 10px;
  border-radius: 999px;
  background: transparent;
  color: #c9ccd3;
  white-space: nowrap;
}
.skin-switcher button[aria-pressed='true'] {
  background: #fff;
  color: #111;
}
@media (max-width: 700px) {
  .skin-switcher {
    /* 避开右下角的搜索按钮 */
    right: 8px;
    left: 8px;
    bottom: calc(84px + env(safe-area-inset-bottom, 0px));
    justify-content: center;
  }
}
</style>
