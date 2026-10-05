<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { animateHeight } from '@/shared/heightTransition'
const props = defineProps<{ open: boolean }>()
// Initially open content participates in its parent's first height measurement.
const rendered = ref(props.open),
  shell = ref<HTMLElement | null>(null),
  content = ref<HTMLElement | null>(null)
let active: AbortController | null = null,
  observer: ResizeObserver | undefined,
  intent = 0,
  lastHeight = 0
function cancel() {
  active?.abort()
  active = null
}
async function resize(to: number, from?: number) {
  cancel()
  const panel = shell.value
  if (!panel) return false
  const controller = new AbortController()
  active = controller
  const finished = await animateHeight(panel, {
    to,
    from,
    signal: controller.signal,
    preserveHeightOnAbort: true,
  })
  if (active !== controller) return false
  active = null
  return finished
}
function observeContent() {
  observer?.disconnect()
  if (!content.value) return
  observer = new ResizeObserver(() => {
    if (!props.open || !content.value || !shell.value) return
    const next = content.value.getBoundingClientRect().height
    if (Math.abs(next - lastHeight) < 0.5) return
    const from = active ? undefined : lastHeight
    lastHeight = next
    // Loaded text and responsive wrapping can change the target during or after opening.
    void resize(next, from)
  })
  observer.observe(content.value)
}
onMounted(() => {
  if (props.open && content.value) {
    lastHeight = content.value.getBoundingClientRect().height
    observeContent()
  }
})
watch(
  () => props.open,
  async open => {
    const current = ++intent
    cancel()
    observer?.disconnect()
    const entering = open && !rendered.value
    if (entering) {
      rendered.value = true
      await nextTick()
    }
    if (current !== intent) return
    if (!shell.value || !content.value) {
      if (!open) rendered.value = false
      return
    }
    if (open) {
      lastHeight = content.value.getBoundingClientRect().height
      observeContent()
      void resize(lastHeight, entering ? 0 : undefined)
    } else {
      const finished = await resize(0)
      if (finished && current === intent && !props.open) rendered.value = false
    }
  },
  { flush: 'post' },
)
onBeforeUnmount(() => {
  ++intent
  observer?.disconnect()
  cancel()
})
</script>
<template>
  <div v-if="rendered" ref="shell" class="height-reveal" :inert="!open">
    <div ref="content" class="height-reveal-content"><slot /></div>
  </div>
</template>
<style scoped>
.height-reveal,
.height-reveal-content {
  display: flow-root;
  min-width: 0;
}
</style>
