import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { createBoardScrollFloor } = await loadTS('../src/boards/boardScrollFloor.ts')
test('品质筛选缩短表格后回到底部，保留正常视窗与英雄榜行为', async () => {
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  }
  let spacer,
    bottom = 1200
  const calls = []
  const root = {
    isConnected: true,
    getBoundingClientRect: () => ({ height: 2000, bottom }),
    after(node) {
      spacer = node
      node.isConnected = true
    },
  }
  globalThis.window = {
    scrollY: 2000,
    innerHeight: 800,
    addEventListener() {},
    removeEventListener() {},
    scrollTo(v) {
      calls.push(v)
      this.scrollY = v.top
    },
  }
  globalThis.document = {
    documentElement: { scrollHeight: 4000, style: {} },
    createElement: () => ({
      isConnected: false,
      style: { height: '0' },
      setAttribute() {},
      getBoundingClientRect() {
        return { height: parseFloat(this.style.height) }
      },
      remove() {
        this.isConnected = false
      },
    }),
  }
  globalThis.cancelAnimationFrame = () => {}
  try {
    const floor = createBoardScrollFloor({ keepBoardVisible: true })
    await floor.preserve(root, async () => {
      bottom = -300
    })
    assert.deepEqual(calls, [{ top: 900, behavior: 'instant' }])
    assert.equal(spacer.isConnected, false)
    calls.length = 0
    await floor.preserve(root, async () => {
      bottom = 1000
    })
    assert.equal(calls.length, 0)
    floor.dispose()
    const legacy = createBoardScrollFloor()
    await legacy.preserve(root, async () => {
      bottom = -300
    })
    assert.equal(calls.length, 0)
    legacy.dispose()
    window.scrollY = 3200
    calls.length = 0
    const edge = createBoardScrollFloor({ keepBoardVisible: true })
    await edge.preserve(root, async () => {
      bottom = 300
    })
    assert.equal(calls[0].top, 2700)
    edge.dispose()
  } finally {
    Object.assign(globalThis, saved)
  }
})
