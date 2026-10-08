<script setup lang="ts">
import { locale, locales, localeNames, setLocale, type Locale } from '@/i18n/locale'
function change(event: Event) {
  void setLocale((event.target as HTMLSelectElement).value as Locale)
}
</script>
<template>
  <span class="language-picker-wrap"
    ><span class="language-picker-icon" aria-hidden="true"></span
    ><select
      class="language-picker"
      name="language"
      :value="locale"
      aria-label="Language / 语言 / 語言 / 言語"
      @change="change"
    >
      <option v-for="code in locales" :key="code" :value="code" :lang="code">
        {{ localeNames[code] }}
      </option>
    </select></span
  >
</template>
<style scoped>
.language-picker-wrap {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  color: var(--text);
}
.language-picker-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  background: currentColor;
  mask: url('../assets/language.svg?no-inline') center/contain no-repeat;
  pointer-events: none;
}
.language-picker {
  padding-left: 32px;
}
</style>
