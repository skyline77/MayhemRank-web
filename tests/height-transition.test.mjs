import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { animateHeight } = await loadTS('../src/shared/heightTransition.ts')
async function fixture(run, reduced = false) {
  const keys = ['window', 'requestAnimationFrame', 'cancelAnimationFrame']
  const saved = Object.fromEntries(keys.map(k => [k, globalThis[k]]))
  const frames = new Map()
  let id = 0
  globalThis.window = { matchMedia: () => ({ matches: reduced }) }
  globalThis.requestAnimationFrame = fn => {
    frames.set(++id, fn)
    return id
  }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  const panel = {
    isConnected: true,
    style: {
      removeProperty(name) {
        delete this[name]
      },
    },
    getBoundingClientRect() {
      return {
        height: this.style.height === undefined ? 400 : Number.parseFloat(this.style.height),
      }
    },
  }
  const tick = t => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(fn => fn(t))
  }
  try {
    await run({ panel, frames, tick })
  } finally {
    for (const key of keys) globalThis[key] = saved[key]
  }
}
test('a reversal starts at the current height, cancels stale completion and cleans final styles', () =>
  fixture(async ({ panel, tick, frames }) => {
    const firstController = new AbortController()
    const opening = animateHeight(panel, {
      from: 0,
      to: 400,
      signal: firstController.signal,
      preserveHeightOnAbort: true,
    })
    tick(0)
    tick(60)
    const partial = panel.getBoundingClientRect().height
    assert.ok(partial > 0 && partial < 400)
    firstController.abort()
    assert.equal(await opening, false)
    assert.equal(panel.getBoundingClientRect().height, partial)
    const closing = animateHeight(panel, { to: 0, signal: new AbortController().signal })
    assert.equal(panel.getBoundingClientRect().height, partial)
    tick(70)
    tick(180)
    assert.ok(panel.getBoundingClientRect().height < partial)
    tick(290)
    assert.equal(await closing, true)
    assert.equal(panel.style.height, undefined)
    assert.equal(panel.style.overflow, undefined)
    assert.equal(frames.size, 0)
  }))
test('detached or pre-cancelled panels stop without queued frames', () =>
  fixture(async ({ panel, tick, frames }) => {
    const controller = new AbortController()
    controller.abort()
    assert.equal(await animateHeight(panel, { to: 0, signal: controller.signal }), false)
    const pending = animateHeight(panel, { to: 0, signal: new AbortController().signal })
    panel.isConnected = false
    tick(0)
    assert.equal(await pending, false)
    assert.equal(panel.style.height, undefined)
    assert.equal(frames.size, 0)
  }))
test('reduced motion applies the final progress immediately without animation frames', () =>
  fixture(async ({ panel, frames }) => {
    const progress = []
    assert.equal(
      await animateHeight(panel, {
        to: 0,
        signal: new AbortController().signal,
        onProgress: v => progress.push(v),
      }),
      true,
    )
    assert.deepEqual(progress, [1])
    assert.equal(frames.size, 0)
    assert.equal(panel.style.height, undefined)
  }, true))

test('late content growth retargets from the painted height without a completion jump or scroll rewind', () =>
  fixture(async ({ panel, tick, frames }) => {
    let natural = 400
    panel.getBoundingClientRect = () => ({
      height: panel.style.height === undefined ? natural : Number.parseFloat(panel.style.height),
    })
    const progress = []
    const done = animateHeight(panel, {
      from: 0,
      to: natural,
      measureTo: () => natural,
      signal: new AbortController().signal,
      onProgress: v => progress.push(v),
    })
    tick(0)
    tick(180)
    const before = panel.getBoundingClientRect().height
    natural = 1200
    tick(200)
    assert.equal(panel.getBoundingClientRect().height, before)
    tick(220)
    assert.ok(
      panel.getBoundingClientRect().height > before &&
        panel.getBoundingClientRect().height < natural,
    )
    assert.ok(frames.size > 0, 'must not release the old target at the original deadline')
    tick(400)
    const penultimate = panel.getBoundingClientRect().height
    tick(420)
    assert.equal(await done, true)
    assert.ok(natural - penultimate < 2)
    assert.equal(panel.getBoundingClientRect().height, natural)
    assert.equal(panel.style.height, undefined)
    assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]))
    assert.equal(frames.size, 0)
  }))

test('geometry is prepared before height writes and retargeting reuses painted height', () =>
  fixture(async ({ panel, tick }) => {
    let reads = 0,
      natural = 400,
      height
    const order = []
    panel.getBoundingClientRect = () => {
      reads++
      return { height: height === undefined ? 400 : parseFloat(height) }
    }
    Object.defineProperty(panel.style, 'height', {
      configurable: true,
      get: () => height,
      set: value => {
        order.push('write')
        height = value
      },
    })
    const done = animateHeight(panel, {
      from: 0,
      to: 400,
      measureTo: () => natural,
      signal: new AbortController().signal,
      prepareProgress: () => {
        order.push('read')
        return () => order.push('scroll')
      },
    })
    order.length = 0
    tick(0)
    tick(100)
    natural = 600
    tick(120)
    tick(340)
    assert.equal(await done, true)
    assert.equal(reads, 0, 'retarget should use stored painted height, not read layout')
    assert.deepEqual(order, [
      'read',
      'write',
      'scroll',
      'read',
      'write',
      'scroll',
      'read',
      'write',
      'scroll',
      'read',
      'write',
      'scroll',
    ])
  }))

test('maxStep caps how far one long frame can advance the tween', () =>
  fixture(async ({ panel, tick }) => {
    const heights = {}
    for (const maxStep of [undefined, 25]) {
      const done = animateHeight(panel, {
        from: 0,
        to: 1000,
        signal: new AbortController().signal,
        maxStep,
      })
      tick(0)
      // 挂载内容后的长帧：实际过去 60ms
      tick(60)
      heights[String(maxStep)] = Number.parseFloat(panel.style.height)
      for (let time = 76; time <= 600; time += 16) tick(time)
      assert.equal(await done, true)
    }
    // 不限幅时一帧前进 60ms，高度已过六成；限幅后只前进 25ms
    assert.ok(heights.undefined > 600)
    const expected = 1000 * (1 - Math.pow(1 - 25 / 220, 3))
    assert.ok(Math.abs(heights['25'] - expected) < 0.5)
  }))
