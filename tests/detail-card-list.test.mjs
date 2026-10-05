import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import { ref, reactive, watch, nextTick, effectScope, computed, watchEffect } from 'vue'
import { loadTS, scriptSetup, stripImports } from './load-ts.mjs'
const { scheduleDetailMeasurement, cancelDetailMeasurement } = await loadTS(
  '../src/details/detailMeasurements.ts',
)
const { detailPaginationKey, pageWindow } = await loadTS('../src/details/detailPagination.ts')
const setup = stripImports(scriptSetup('../src/details/DetailCardList.vue'))
const compiled = ts.transpile(setup + '\nreturn {scroller,hasMore,schedule,scroll,visibleCount}', {
  target: ts.ScriptTarget.ES2022,
})
function harness(t, loading = false, options = {}) {
  const props = reactive({ loading, resetKey: 'items', ...options })
  const scope = effectScope(),
    hooks = { unmount: () => unmount.splice(0).forEach(fn => fn()) },
    unmount = [],
    frames = new Map(),
    changes = []
  let serial = 0,
    disconnected = false,
    resize
  const saved = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  }
  globalThis.requestAnimationFrame = fn => {
    frames.set(++serial, fn)
    return serial
  }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  const tick = () => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(fn => fn())
  }
  const env = {
    ref,
    watch,
    nextTick,
    computed,
    watchEffect,
    inject: () => null,
    detailPaginationKey,
    pageWindow,
    scheduleDetailMeasurement,
    cancelDetailMeasurement,
    createBoardReflow: () => ({ run: async (_root, render) => render(), stop: () => {} }),
    defineOptions: () => {},
    defineProps: () => props,
    onMounted: fn => (hooks.mount = fn),
    onUpdated: fn => (hooks.update = fn),
    onUnmounted: fn => unmount.push(fn),
    requestAnimationFrame: fn => {
      frames.set(++serial, fn)
      return serial
    },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class {
      constructor(fn) {
        resize = fn
      }
      observe() {}
      disconnect() {
        disconnected = true
      }
    },
  }
  const run = new Function(...Object.keys(env), compiled)
  const app = scope.run(() => run(...Object.values(env)))
  const element = {
    isConnected: true,
    closest: () => null,
    clientWidth: 300,
    scrollWidth: 800,
    scrollLeft: 0,
  }
  app.scroller.value = element
  scope.run(() => watch(app.hasMore, value => changes.push(value), { flush: 'sync' }))
  hooks.mount()
  tick()
  t.after(() => {
    hooks.unmount()
    scope.stop()
    Object.assign(globalThis, saved)
  })
  return {
    ...app,
    props,
    element,
    hooks,
    frames,
    changes,
    resize: () => resize(),
    tick,
    isDisconnected: () => disconnected,
  }
}
test('overflowing roles retain one continuous shadow through loading and the next render', async t => {
  const app = harness(t)
  assert.equal(app.hasMore.value, true)
  app.schedule() // a scroll measurement was already queued when loading starts
  app.props.loading = true
  await nextTick()
  app.element.scrollWidth = 300
  app.hooks.update()
  app.tick()
  assert.equal(app.hasMore.value, true)
  app.element.scrollWidth = 1000
  app.hooks.update()
  app.element.scrollWidth = 700
  app.props.loading = false
  await nextTick()
  app.hooks.update()
  app.tick()
  assert.equal(app.hasMore.value, true)
  assert.deepEqual(app.changes, [true])
  assert.equal(app.frames.size, 0)
})
test('skeletons never invent a shadow for non-overflowing content, including initial load', async t => {
  const app = harness(t, true)
  assert.equal(app.hasMore.value, false)
  app.resize()
  app.hooks.update()
  app.tick()
  assert.equal(app.hasMore.value, false)
  app.element.scrollWidth = 200
  app.props.loading = false
  await nextTick()
  app.hooks.update()
  app.tick()
  assert.equal(app.hasMore.value, false)
  assert.deepEqual(app.changes, [])
})
test('new content removes unnecessary shading immediately; loading completion resets the rail', async t => {
  const app = harness(t)
  app.element.scrollLeft = 500
  app.schedule()
  app.tick()
  assert.equal(app.hasMore.value, false)
  app.props.loading = true
  await nextTick()
  app.element.scrollWidth = 1200
  app.hooks.update()
  app.tick()
  assert.equal(app.hasMore.value, false)
  app.props.loading = false
  await nextTick()
  app.hooks.update()
  app.tick()
  assert.equal(app.element.scrollLeft, 0)
  assert.equal(app.hasMore.value, true)
  app.props.loading = true
  await nextTick()
  app.element.scrollWidth = 200
  app.props.loading = false
  await nextTick()
  app.hooks.update()
  app.tick()
  assert.equal(app.hasMore.value, false)
  assert.equal(app.frames.size, 0)
})
test('search resets position without remounting; scrolling and resize still measure overflow', async t => {
  const app = harness(t)
  app.element.scrollLeft = 500
  app.schedule()
  app.tick()
  assert.equal(app.hasMore.value, false)
  app.props.resetKey = 'items+sword'
  await nextTick()
  app.tick()
  assert.equal(app.element.scrollLeft, 0)
  assert.equal(app.hasMore.value, true)
  app.element.clientWidth = 1000
  app.resize()
  app.tick()
  assert.equal(app.hasMore.value, false)
  app.element.clientWidth = 200
  app.resize()
  app.tick()
  assert.equal(app.hasMore.value, true)
  app.schedule()
  app.hooks.unmount()
  assert.equal(app.frames.size, 0)
  assert.equal(app.isDisconnected(), true)
})

test('batched cards start at twenty, append near end, reset on sort and never append while loading', async t => {
  const app = harness(t, false, { batchSize: 20, itemCount: 45 })
  assert.equal(app.visibleCount.value, 20)
  app.hooks.update()
  app.resize()
  app.tick()
  assert.equal(app.visibleCount.value, 20)
  app.element.scrollLeft = 400
  app.scroll()
  await nextTick()
  app.tick()
  assert.equal(app.visibleCount.value, 40)
  app.element.scrollWidth = 1500
  app.element.scrollLeft = 1100
  app.scroll()
  await nextTick()
  app.tick()
  assert.equal(app.visibleCount.value, 45)
  app.props.resetKey = 'delta'
  await nextTick()
  app.tick()
  assert.equal(app.visibleCount.value, 20)
  assert.equal(app.element.scrollLeft, 0)
  app.props.loading = true
  await nextTick()
  app.element.scrollLeft = 1200
  app.scroll()
  assert.equal(app.visibleCount.value, 20)
  app.props.loading = false
  await nextTick()
  app.tick()
  assert.equal(app.visibleCount.value, 20)
  assert.equal(app.element.scrollLeft, 0)
})

// 模拟元素只提供行定位，不提供卡片遍历或克隆；提示更新必须
// retain scroll state without taking snapshots of the rendered cards.
test('ordinary updates and reduced overflow hints need no card DOM snapshots', async t => {
  const app = harness(t)
  app.element.scrollLeft = 80
  for (let i = 0; i < 30; i++) {
    app.hooks.update()
    app.schedule()
    app.tick()
  }
  assert.equal(app.element.scrollLeft, 80)
  assert.equal(app.hasMore.value, true)
})
