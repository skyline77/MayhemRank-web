import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { captureColumns, prepareColumns } = await loadTS('../src/boards/boardColumnMotion.ts')
test('column decoration and header labels animate transforms without changing layout; cleanup removes layers', () => {
  const saved = {
    document: globalThis.document,
    innerHeight: globalThis.innerHeight,
    matchMedia: globalThis.matchMedia,
  }
  let expanded = false,
    writes = false,
    readsAfterWrites = 0
  const animations = [],
    nodes = [],
    classes = new Set()
  const rect = (left, width) => {
    if (writes) readsAfterWrites++
    return { left, width, top: 0, bottom: 50, height: 50 }
  }
  const cells = [0, 1].map(i => ({
    getBoundingClientRect: () =>
      rect(i ? (expanded ? 260 : 100) : 0, i ? (expanded ? 40 : 200) : expanded ? 260 : 100),
    querySelector: () => (i === 0 && !expanded ? {} : null),
  }))
  const row = {
    classList: {
      contains: c => c === 'board-column-head',
      add: c => classes.add(c),
      remove: c => classes.delete(c),
    },
    getBoundingClientRect: () => rect(0, 300),
    querySelectorAll: s => (s.includes('column-motion') ? [] : cells),
    append: (...items) => {
      writes = true
      nodes.push(...items)
    },
  }
  const label = {
    getBoundingClientRect: () => rect(expanded ? 120 : 40, 20),
    animate: (frames, options) => animation(frames, options),
  }
  function animation(frames, options) {
    const a = {
      frames,
      options,
      cancelled: false,
      cancel() {
        this.cancelled = true
      },
    }
    animations.push(a)
    return a
  }
  globalThis.document = {
    createElement: () => ({
      style: {},
      dataset: {},
      setAttribute() {},
      animate: animation,
      remove() {
        this.removed = true
      },
    }),
  }
  globalThis.innerHeight = 800
  globalThis.matchMedia = () => ({ matches: false })
  const root = {
    querySelector: () => row,
    querySelectorAll: s => (s.includes('board-column-content') ? [label] : [row]),
  }
  try {
    const before = captureColumns(root)
    expanded = true
    const start = prepareColumns(root, before),
      motion = start()
    assert.equal(animations.length, 7)
    assert.equal(readsAfterWrites, 0)
    assert.ok(
      animations.every(
        a =>
          a.options.duration === 320 &&
          a.frames.every(f => !('width' in f) && !('gridTemplateColumns' in f)),
      ),
    )
    assert.match(animations[0].frames[0].transform, /scaleX/)
    assert.equal(animations[2].frames[0].opacity, 1)
    assert.equal(animations[2].frames[1].opacity, 0)
    assert.match(animations[3].frames[1].transform, /scaleX\(0\)/)
    assert.equal(animations[6].frames[0].transform, 'translate3d(-80px,0px,0)')
    motion.cleanup()
    assert.equal(classes.size, 0)
    assert.ok(nodes.every(n => n.removed))
    assert.ok(animations.every(a => a.cancelled))
  } finally {
    Object.assign(globalThis, saved)
  }
})
