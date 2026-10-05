<script setup lang="ts">
import { t, message } from './i18n'
import { ref } from 'vue'
import { isSearchSubmit } from './search'
import { handleSearchArrow, rememberSearchFocus } from './searchShortcut'
const focused = ref(false)
const pointerFocus = ref(false)
const composing = ref(false)
function focus(event: FocusEvent) {
  focused.value = true
  rememberSearchFocus(event.currentTarget as HTMLInputElement)
  emit('focus', event)
}
function blur(event: FocusEvent) {
  focused.value = false
  pointerFocus.value = false
  emit('blur', event)
}
const model = defineModel<string>({ required: true })
const emit = defineEmits<{
  'escape-clear': []
  submit: []
  keydown: [event: KeyboardEvent]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()
// Vue's v-model waits for compositionend. Publish preedit input as well, while
// retaining v-model's composition guard so rerenders do not rewrite IME text.
function onInput(event: Event) {
  model.value = (event.target as HTMLInputElement).value
}
function onCompositionStart() {
  composing.value = true
}
function onCompositionEnd(event: CompositionEvent) {
  composing.value = false
  onInput(event)
}
function onKeydown(event: KeyboardEvent) {
  if (composing.value || event.isComposing || event.keyCode === 229) return
  // Suggestions (including empty-query history) own arrows before field switching.
  emit('keydown', event)
  if (event.defaultPrevented) return
  if (handleSearchArrow(event)) return
  if ((props.scope === 'hero' || props.scope === 'rune') && isSearchSubmit(event)) {
    event.preventDefault()
    event.stopPropagation()
    emit('submit')
    return
  }
  if (event.key !== 'Escape' || event.isComposing) return
  event.preventDefault()
  event.stopPropagation()
  if (event.repeat) return
  if (model.value) {
    emit('escape-clear')
    model.value = ''
  } else {
    ;(event.currentTarget as HTMLInputElement).blur()
  }
}
const props = defineProps<{
  label: string
  placeholder: string
  hint?: string
  hintIcon?: string
  hintIcons?: string[]
  scope?: 'hero' | 'detail' | 'rune'
  inputAttrs?: Record<string, string | boolean | undefined>
}>()
</script>
<template>
  <label
    class="search"
    :class="{
      'keyboard-focus': focused && !pointerFocus,
      'has-search-hint': !!(hint || hintIcon || hintIcons?.length),
    }"
    @pointerdown="pointerFocus = true"
    ><svg
      class="search-icon"
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" /></svg
    ><input
      v-bind="inputAttrs"
      v-model="model"
      :data-site-search="scope"
      :aria-keyshortcuts="scope ? 'Control+F Meta+F' : undefined"
      :aria-label="label"
      :placeholder="placeholder"
      :data-search-placeholder="placeholder"
      type="search"
      @input="onInput"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
      @keydown="onKeydown"
      @focus="focus"
      @blur="blur" /><span
      v-if="hint || hintIcon || hintIcons?.length"
      class="search-hint"
      aria-hidden="true"
      ><span v-if="hint">{{ t('例：') }}{{ hint }}</span
      ><img
        v-for="icon in hintIcons || (hintIcon ? [hintIcon] : [])"
        :key="icon"
        :src="icon"
        alt=""
        width="22"
        height="22"
        draggable="false" /></span
  ></label>
</template>

<style scoped>
.search.has-search-hint input {
  flex: 1;
  width: 0;
  min-width: 0;
}
.search-hint {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
}
.search-hint img {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  border-radius: 4px;
  object-fit: cover;
}
.search input:focus {
  outline: none;
}
.search.keyboard-focus {
  border-color: var(--muted);
}
.search-icon {
  display: block;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}
</style>
