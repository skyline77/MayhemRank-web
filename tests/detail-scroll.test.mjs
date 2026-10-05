import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const {
  fadeDetailAtTop,
  replaceDetailEntry,
  revealDetailImmediately,
  scrollDetailToTop,
  transitionDetail,
  handoffDetail,
  cancelDetailTransition,
  preserveDetailPosition,
} = await loadTS('../src/details/detailScroll.ts')

test('shared scroll aligns the panel and respects reduced motion', () => {
  const original = globalThis.window
  const calls = []
  try {
    globalThis.window = {
      scrollBy: value => calls.push(value),
      matchMedia: () => ({ matches: false }),
    }
    const panel = { isConnected: true, getBoundingClientRect: () => ({ top: 345 }) }
    scrollDetailToTop(panel)
    globalThis.window.matchMedia = () => ({ matches: true })
    scrollDetailToTop(panel)
    scrollDetailToTop(null)
    scrollDetailToTop({ ...panel, isConnected: false })
    assert.deepEqual(calls, [
      { top: 345, behavior: 'smooth' },
      { top: 345, behavior: 'instant' },
    ])
  } finally {
    globalThis.window = original
  }
})

async function motionFixture(run, { reduced = false } = {}) {
  const keys = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame']
  const saved = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  const frames = new Map(),
    classes = new Set(),
    events = new Map()
  let next = 0,
    current,
    old
  const style = () => ({
    removeProperty(name) {
      delete this[name]
    },
  })
  const makePanel = top => ({
    isConnected: true,
    style: style(),
    querySelector: () => null,
    getBoundingClientRect() {
      return {
        top: top() - window.scrollY,
        height: this.style.height ? Math.max(0, parseFloat(this.style.height)) : 400,
      }
    },
  })
  globalThis.window = {
    scrollY: 300,
    innerHeight: 800,
    matchMedia: () => ({ matches: reduced }),
    scrollBy({ top }) {
      this.scrollY += top
    },
    addEventListener: (key, fn) => events.set(key, fn),
    removeEventListener: (key, fn) => {
      if (events.get(key) === fn) events.delete(key)
    },
  }
  globalThis.document = {
    documentElement: {
      classList: { add: key => classes.add(key), remove: key => classes.delete(key) },
    },
  }
  globalThis.requestAnimationFrame = fn => {
    frames.set(++next, fn)
    return next
  }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  old = makePanel(() => 100)
  current = old
  const anchor = {
    isConnected: true,
    getBoundingClientRect: () => ({
      top: 500 + (old.isConnected ? old.getBoundingClientRect().height : 0) - window.scrollY,
    }),
  }
  const render = async () => {
    old.isConnected = false
    current = makePanel(() => 580)
  }
  const tick = async time => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(fn => fn(time))
    await new Promise(resolve => setImmediate(resolve))
  }
  try {
    await run({
      old,
      anchor,
      panel: () => current,
      render,
      tick,
      classes,
      events,
      frames,
      setPanel: p => {
        current = p
      },
    })
  } finally {
    cancelDetailTransition()
    await new Promise(resolve => setImmediate(resolve))
    for (const key of keys) {
      if (saved[key] === undefined) delete globalThis[key]
      else globalThis[key] = saved[key]
    }
  }
}

test('collapsing an upper panel preserves the lower portrait, then the new panel reaches the top', () =>
  motionFixture(async f => {
    const top = f.anchor.getBoundingClientRect().top
    const done = transitionDetail({
      panel: f.panel,
      anchor: () => f.anchor,
      render: f.render,
      opening: true,
    })
    await f.tick(0)
    await f.tick(110)
    assert.ok(
      f.old.getBoundingClientRect().height > 0 && f.old.getBoundingClientRect().height < 400,
    )
    assert.equal(f.anchor.getBoundingClientRect().top, top)
    await f.tick(220)
    await f.tick(221)
    await f.tick(441)
    assert.equal(await done, true)
    assert.equal(f.panel().getBoundingClientRect().top, 0)
    assert.equal(f.panel().style.height, undefined)
    assert.equal(f.classes.size, 0)
    assert.equal(f.events.size, 0)
  }))

test('a newer click cancels the old render and owns the remaining animation', () =>
  motionFixture(async f => {
    let obsoleteRenders = 0
    const first = transitionDetail({
      panel: f.panel,
      anchor: () => f.anchor,
      render: async () => {
        obsoleteRenders++
      },
      opening: true,
    })
    await f.tick(0)
    await f.tick(60)
    const second = transitionDetail({
      panel: f.panel,
      anchor: () => f.anchor,
      render: f.render,
      opening: true,
    })
    await f.tick(70)
    await f.tick(290)
    await f.tick(291)
    await f.tick(511)
    assert.equal(await first, false)
    assert.equal(await second, true)
    assert.equal(obsoleteRenders, 0)
    assert.equal(f.frames.size, 0)
    assert.equal(f.classes.size, 0)
  }))

test('manual wheel input stops auto scrolling without leaving a clipped panel', () =>
  motionFixture(async f => {
    f.old.isConnected = false
    f.setPanel(null)
    const done = transitionDetail({
      panel: f.panel,
      anchor: () => f.anchor,
      render: f.render,
      opening: true,
    })
    await new Promise(resolve => setImmediate(resolve))
    await f.tick(0)
    await f.tick(50)
    f.events.get('wheel')()
    const y = window.scrollY
    await f.tick(110)
    await f.tick(220)
    assert.equal(await done, true)
    assert.equal(window.scrollY, y)
    assert.equal(f.panel().style.height, undefined)
  }))

test('sequential opening keeps the viewport still until full height, then scrolls to the top', () =>
  motionFixture(async f => {
    f.old.isConnected = false
    f.setPanel(null)
    const y = window.scrollY
    const done = transitionDetail({
      panel: f.panel,
      anchor: () => f.anchor,
      render: f.render,
      opening: true,
      scrollAfterOpen: true,
    })
    await new Promise(resolve => setImmediate(resolve))
    await f.tick(0)
    await f.tick(110)
    assert.ok(
      f.panel().getBoundingClientRect().height > 0 &&
        f.panel().getBoundingClientRect().height < 400,
    )
    assert.equal(window.scrollY, y)
    await f.tick(220)
    assert.equal(f.panel().style.height, undefined)
    assert.equal(window.scrollY, y)
    await f.tick(221)
    await f.tick(381)
    assert.equal(f.panel().getBoundingClientRect().height, 400)
    assert.ok(window.scrollY > y)
    await f.tick(541)
    assert.equal(await done, true)
    assert.equal(f.panel().getBoundingClientRect().top, 0)
    assert.equal(f.frames.size, 0)
  }))

test('manual scrolling during sequential expansion cancels the later automatic scroll', () =>
  motionFixture(async f => {
    f.old.isConnected = false
    f.setPanel(null)
    const done = transitionDetail({
      panel: f.panel,
      anchor: () => f.anchor,
      render: f.render,
      opening: true,
      scrollAfterOpen: true,
    })
    await new Promise(resolve => setImmediate(resolve))
    await f.tick(0)
    await f.tick(110)
    f.events.get('wheel')()
    const y = window.scrollY
    await f.tick(220)
    await f.tick(221)
    assert.equal(await done, true)
    assert.equal(window.scrollY, y)
    assert.equal(f.panel().style.height, undefined)
    assert.equal(f.frames.size, 0)
  }))

test('reduced motion finishes directly and closing restores the portrait position', () =>
  motionFixture(
    async f => {
      const done = transitionDetail({
        panel: f.panel,
        anchor: () => f.anchor,
        opening: false,
        closeInset: 120,
        render: async () => {
          f.old.isConnected = false
          f.setPanel(null)
        },
      })
      assert.equal(await done, true)
      assert.equal(f.frames.size, 0)
      assert.equal(f.classes.size, 0)
      assert.equal(f.anchor.getBoundingClientRect().top, 600)
    },
    { reduced: true },
  ))

test('different rows coexist until arrival, then the old detail collapses before removal', () =>
  motionFixture(async f => {
    let prepared = false,
      removed = false
    const destination = {
      isConnected: true,
      getBoundingClientRect: () => ({
        top: 500 + (f.old.isConnected ? f.old.getBoundingClientRect().height : 0) - window.scrollY,
        height: 400,
      }),
    }
    const oldTop = f.old.getBoundingClientRect().top
    const done = handoffDetail({
      previous: () => f.old,
      target: () => destination,
      sameRow: false,
      prepare: async () => {
        prepared = true
      },
      finish: async () => {
        removed = true
        f.old.isConnected = false
      },
    })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(prepared, true)
    assert.equal(removed, false)
    assert.equal(f.old.getBoundingClientRect().top, oldTop)
    await f.tick(0)
    await f.tick(160)
    assert.equal(f.old.isConnected, true)
    assert.equal(removed, false)
    await f.tick(320)
    assert.equal(removed, false)
    await f.tick(321)
    await f.tick(431)
    assert.ok(
      f.old.getBoundingClientRect().height > 0 && f.old.getBoundingClientRect().height < 400,
    )
    assert.equal(removed, false)
    assert.equal(destination.getBoundingClientRect().top, 0)
    await f.tick(541)
    assert.equal(await done, true)
    assert.equal(removed, true)
    assert.equal(destination.getBoundingClientRect().top, 0)
    assert.equal(window.scrollY, 500)
    assert.equal(f.classes.size, 0)
  }))

test('inserting a new upper row keeps the previous detail at its original viewport position', () =>
  motionFixture(async f => {
    let prepared = false
    f.old.getBoundingClientRect = () => ({
      top: 100 + (prepared ? 400 : 0) - window.scrollY,
      height: 400,
    })
    const before = f.old.getBoundingClientRect().top
    const destination = {
      isConnected: true,
      getBoundingClientRect: () => ({ top: 50 - window.scrollY, height: 400 }),
    }
    const done = handoffDetail({
      previous: () => f.old,
      target: () => destination,
      sameRow: false,
      prepare: async () => {
        prepared = true
      },
      finish: async () => {
        f.old.isConnected = false
      },
    })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(f.old.getBoundingClientRect().top, before)
    await f.tick(0)
    await f.tick(650)
    await f.tick(651)
    await f.tick(871)
    assert.equal(await done, true)
    assert.equal(destination.getBoundingClientRect().top, 0)
  }))

test('same-row update reuses the panel without height animation or scrolling', () =>
  motionFixture(async f => {
    const original = f.panel()
    let updates = 0
    const done = handoffDetail({
      previous: f.panel,
      target: f.panel,
      sameRow: true,
      prepare: async () => {
        updates++
      },
      finish: async () => {},
    })
    assert.equal(await done, true)
    assert.equal(updates, 1)
    assert.equal(f.panel(), original)
    assert.equal(f.panel().style.height, undefined)
    assert.equal(f.frames.size, 0)
    assert.equal(window.scrollY, 300)
  }))

test('interrupted handoff does not remove the old detail before reaching its target', () =>
  motionFixture(async f => {
    let removed = false
    const destination = {
      isConnected: true,
      getBoundingClientRect: () => ({ top: 900 - window.scrollY, height: 400 }),
    }
    const done = handoffDetail({
      previous: f.panel,
      target: () => destination,
      sameRow: false,
      prepare: async () => {},
      finish: async () => {
        removed = true
      },
    })
    await new Promise(resolve => setImmediate(resolve))
    await f.tick(0)
    await f.tick(80)
    f.events.get('wheel')()
    assert.equal(await done, false)
    assert.equal(removed, false)
    assert.equal(f.old.isConnected, true)
    assert.equal(f.frames.size, 0)
    assert.equal(f.classes.size, 0)
  }))

test('rapid handoff replacement cannot run an obsolete removal callback', () =>
  motionFixture(async f => {
    const destination = {
      isConnected: true,
      getBoundingClientRect: () => ({ top: 900 - window.scrollY, height: 400 }),
    }
    let stale = 0,
      latest = 0
    const first = handoffDetail({
      previous: f.panel,
      target: () => destination,
      sameRow: false,
      prepare: async () => {},
      finish: async () => {
        stale++
      },
    })
    await new Promise(resolve => setImmediate(resolve))
    await f.tick(0)
    await f.tick(70)
    const second = handoffDetail({
      previous: f.panel,
      target: () => destination,
      sameRow: false,
      prepare: async () => {},
      finish: async () => {
        latest++
      },
    })
    await new Promise(resolve => setImmediate(resolve))
    await f.tick(80)
    await f.tick(400)
    await f.tick(401)
    await f.tick(621)
    assert.equal(await first, false)
    assert.equal(await second, true)
    assert.equal(stale, 0)
    assert.equal(latest, 1)
    assert.equal(f.frames.size, 0)
  }))

test('cancelling retirement restores the old shell and never runs obsolete removal', () =>
  motionFixture(async f => {
    let removed = false
    const destination = {
      isConnected: true,
      getBoundingClientRect: () => ({ top: 900 - window.scrollY, height: 400 }),
    }
    const done = handoffDetail({
      previous: f.panel,
      target: () => destination,
      sameRow: false,
      prepare: async () => {},
      finish: async () => {
        removed = true
      },
    })
    await new Promise(resolve => setImmediate(resolve))
    await f.tick(0)
    await f.tick(320)
    await f.tick(321)
    await f.tick(431)
    assert.ok(f.old.getBoundingClientRect().height < 400)
    cancelDetailTransition()
    assert.equal(await done, false)
    assert.equal(removed, false)
    assert.equal(f.old.style.height, undefined)
    assert.equal(f.old.style.overflow, undefined)
    assert.equal(f.frames.size, 0)
    assert.equal(f.classes.size, 0)
    assert.equal(f.events.size, 0)
  }))

test('reduced-motion handoff closes and removes directly without animation frames', () =>
  motionFixture(
    async f => {
      let removed = false
      const destination = {
        isConnected: true,
        getBoundingClientRect: () => ({
          top:
            500 + (f.old.isConnected ? f.old.getBoundingClientRect().height : 0) - window.scrollY,
          height: 400,
        }),
      }
      const done = handoffDetail({
        previous: f.panel,
        target: () => destination,
        sameRow: false,
        prepare: async () => {},
        finish: async () => {
          removed = true
          f.old.isConnected = false
        },
      })
      assert.equal(await done, true)
      assert.equal(removed, true)
      assert.equal(destination.getBoundingClientRect().top, 0)
      assert.equal(f.frames.size, 0)
      assert.equal(f.classes.size, 0)
      assert.equal(f.events.size, 0)
    },
    { reduced: true },
  ))

test('version relocation preserves a detail offset when its old row is replaced', () =>
  motionFixture(async f => {
    f.old.contains = () => false
    const before = f.panel().getBoundingClientRect().top
    await preserveDetailPosition(f.panel, f.render)
    assert.notEqual(f.panel(), f.old)
    assert.equal(f.panel().getBoundingClientRect().top, before)
    assert.equal(f.frames.size, 0)
    assert.equal(f.classes.size, 0)
  }))

test('version relocation without a surviving detail does not scroll or reopen it', () =>
  motionFixture(async f => {
    f.old.contains = () => false
    await preserveDetailPosition(f.panel, async () => {
      f.old.isConnected = false
      f.setPanel(null)
    })
    assert.equal(window.scrollY, 300)
    assert.equal(f.classes.size, 0)
  }))

test('cancelled version render cannot override a newer navigation', () =>
  motionFixture(async f => {
    f.old.contains = () => false
    await preserveDetailPosition(f.panel, async () => {
      await f.render()
      cancelDetailTransition()
    })
    assert.equal(window.scrollY, 300)
    assert.equal(f.classes.size, 0)
  }))

test('upper handoffs move at half the downward pace while retaining distance-based timing', async () => {
  const samples = []
  for (const distance of [600, -600, 1200, -1200]) {
    await motionFixture(async f => {
      window.scrollY = 2000
      const startY = window.scrollY,
        targetY = startY + distance
      const destination = {
        isConnected: true,
        getBoundingClientRect: () => ({ top: targetY - window.scrollY, height: 400 }),
      }
      let finished = false
      const done = handoffDetail({
        previous: () => null,
        target: () => destination,
        sameRow: false,
        prepare: async () => {},
        finish: async () => {
          finished = true
        },
      })
      await new Promise(resolve => setImmediate(resolve))
      const duration = Math.abs(distance) / (distance < 0 ? 1 : 2)
      await f.tick(0)
      await f.tick(duration / 2)
      assert.equal(finished, false)
      samples.push(Math.abs(window.scrollY - startY) / (duration / 2))
      assert.ok(Math.abs(window.scrollY - startY) < Math.abs(distance))
      await f.tick(300)
      assert.equal(finished, duration <= 300, 'upper and longer trips must still be moving')
      await f.tick(duration)
      assert.equal(await done, true)
      assert.equal(destination.getBoundingClientRect().top, 0)
      assert.equal(f.frames.size, 0)
    })
  }
  assert.ok(Math.abs(samples[0] - samples[2]) < 0.001)
  assert.ok(Math.abs(samples[1] - samples[3]) < 0.001)
  assert.ok(Math.abs(samples[0] - 2 * samples[1]) < 0.001)
})

test('opening details leaves space for the sticky navigation', () =>
  motionFixture(async f => {
    document.querySelector = () => ({ offsetHeight: 101 })
    const done = transitionDetail({
      panel: f.panel,
      anchor: () => f.anchor,
      render: f.render,
      opening: true,
      scrollAfterOpen: true,
    })
    for (let time = 0; time <= 2000; time += 100) await f.tick(time)
    assert.equal(await done, true)
    assert.ok(Math.abs(f.panel().getBoundingClientRect().top - 101) < 0.2)
  }))

test('closing details keeps the trigger below navigation and the returning table header', () =>
  motionFixture(async f => {
    document.querySelector = () => ({ offsetHeight: 101 })
    const done = transitionDetail({
      panel: f.panel,
      anchor: () => f.anchor,
      render: async () => {},
      opening: false,
      closeInset: 64,
    })
    for (let time = 0; time <= 1000; time += 100) await f.tick(time)
    assert.equal(await done, true)
    assert.ok(f.anchor.getBoundingClientRect().top >= 165)
  }))

test('deep link mounts at full height and reaches its final offset without any animation frames', () =>
  motionFixture(async f => {
    document.querySelector = () => ({ offsetHeight: 58 })
    f.old.isConnected = false
    f.setPanel(null)
    const calls = []
    const scroll = window.scrollBy.bind(window)
    window.scrollBy = value => {
      calls.push(value)
      scroll(value)
    }
    assert.equal(await revealDetailImmediately(f.panel, f.render), true)
    assert.equal(f.panel().getBoundingClientRect().top, 58)
    assert.equal(f.panel().getBoundingClientRect().height, 400)
    assert.equal(f.panel().style.height, undefined)
    assert.equal(f.frames.size, 0)
    assert.deepEqual(calls, [{ top: 222, behavior: 'instant' }])
    assert.equal(f.classes.size, 0)
  }))

test('cancelled deep link cannot scroll after a newer interaction takes over', () =>
  motionFixture(async f => {
    let finish
    const y = window.scrollY
    const done = revealDetailImmediately(
      f.panel,
      () =>
        new Promise(resolve => {
          finish = resolve
        }),
    )
    cancelDetailTransition()
    finish()
    assert.equal(await done, false)
    assert.equal(window.scrollY, y)
    assert.equal(f.frames.size, 0)
    assert.equal(f.classes.size, 0)
  }))

test('search replacement shares one slot and preserves viewport for both board entry types', () =>
  motionFixture(async f => {
    f.old.contains = () => false
    for (const entry of [
      { id: 'hero-120', championId: 120 },
      { id: 'rune-1195', rarity: 0 },
    ]) {
      const selected = { value: { id: 'old' } },
        openPanels = { value: { original: selected.value, closing: { id: 'closing' } } }
      const y = window.scrollY,
        top = f.panel().getBoundingClientRect().top
      let cleaned = 0,
        rendered = 0
      assert.equal(
        await replaceDetailEntry({
          entry,
          key: 'original',
          loading: false,
          selected,
          openPanels,
          panel: f.panel,
          beforeReplace: () => {
            cleaned++
            assert.equal(selected.value.id, 'old')
          },
          afterRender: async () => {
            rendered++
            assert.equal(selected.value, entry)
          },
        }),
        true,
      )
      assert.deepEqual(openPanels.value, { original: entry })
      assert.equal(cleaned, 1)
      assert.equal(rendered, 1)
      assert.equal(window.scrollY, y)
      assert.equal(f.panel().getBoundingClientRect().top, top)
      assert.equal(f.frames.size, 0)
      for (const guard of [
        { loading: true, key: 'original' },
        { loading: false, key: 'missing' },
      ]) {
        assert.equal(
          await replaceDetailEntry({
            entry: { id: 'ignored' },
            ...guard,
            selected,
            openPanels,
            panel: f.panel,
            beforeReplace: () => assert.fail('must not clean up'),
            afterRender: async () => assert.fail('must not render'),
          }),
          false,
        )
        assert.equal(selected.value, entry)
      }
    }
  }))

test('hero replacement aligns immediately, fading heading before body without height frames', () =>
  motionFixture(async f => {
    const calls = [],
      completions = []
    const elements = [true, false].map(heading => ({
      classList: { contains: () => heading },
      animate: (frames, options) => {
        calls.push(options)
        return { finished: new Promise(resolve => completions.push(resolve)), cancel() {} }
      },
    }))
    const done = fadeDetailAtTop(f.panel, async () => {
      await f.render()
      f.panel().querySelectorAll = () => elements
    })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(f.panel().getBoundingClientRect().top, 0)
    assert.equal(f.frames.size, 0)
    assert.deepEqual(
      calls.map(({ duration, delay }) => ({ duration, delay })),
      [
        { duration: 140, delay: 0 },
        { duration: 380, delay: 90 },
      ],
    )
    assert.ok(f.classes.has('is-detail-moving'))
    completions.forEach(resolve => resolve())
    assert.equal(await done, true)
    assert.equal(f.classes.size, 0)
  }))

test('reduced-motion hero replacement aligns without opacity animations', () =>
  motionFixture(
    async f => {
      assert.equal(await fadeDetailAtTop(f.panel, f.render), true)
      assert.equal(f.panel().getBoundingClientRect().top, 0)
      assert.equal(f.frames.size, 0)
      assert.equal(f.classes.size, 0)
    },
    { reduced: true },
  ))

test('hero search replacement reuses the top-aligned reveal instead of preserving the old offset', () =>
  motionFixture(
    async f => {
      const selected = { value: { id: 'old' } },
        openPanels = { value: { slot: selected.value } }
      const entry = { id: 'new' }
      const before = f.panel().getBoundingClientRect().top
      assert.notEqual(before, 0)
      assert.equal(
        await replaceDetailEntry({
          entry,
          key: 'slot',
          loading: false,
          selected,
          openPanels,
          panel: f.panel,
          transition: fadeDetailAtTop,
          afterRender: async () => {},
        }),
        true,
      )
      assert.equal(f.panel().getBoundingClientRect().top, 0)
      assert.equal(selected.value, entry)
      assert.deepEqual(openPanels.value, { slot: entry })
      assert.equal(f.classes.size, 0)
    },
    { reduced: true },
  ))
