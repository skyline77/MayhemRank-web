import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
const js = ts.transpile(
  readFileSync(new URL('../src/searchShortcut.ts', import.meta.url), 'utf8'),
  { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
)
const {
  findSiteSearch,
  nextFindTarget,
  handleFindShortcut,
  handleDetailEscape,
  handleSearchArrow,
  rememberSearchFocus,
} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const viewport = { innerHeight: 800, innerWidth: 1200 }
function input(scope, top = 0, bottom = 800) {
  const calls = []
  const panel = {
    getBoundingClientRect: () => ({ top, bottom, left: 0, right: 1000 }),
    contains: node => node === field,
  }
  const field = {
    value: '',
    dataset: { siteSearch: scope },
    disabled: false,
    getClientRects: () => [{}],
    closest: () => (scope === 'detail' ? panel : null),
    focus: options => calls.push(['focus', options]),
    select: () => calls.push(['select']),
    scrollIntoView: options => calls.push(['scroll', options]),
    calls,
  }
  return field
}
const documentFor = (inputs, activeElement = null) => ({
  querySelector: () => null,
  querySelectorAll: () => inputs,
  activeElement,
})
const key = (overrides = {}) => ({
  key: 'f',
  ctrlKey: true,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  isComposing: false,
  defaultPrevented: false,
  preventDefault() {
    this.defaultPrevented = true
  },
  ...overrides,
})

test('uses hero search when details are closed or outside the viewport', () => {
  const hero = input('hero'),
    detail = input('detail', 900, 1800)
  assert.equal(findSiteSearch(documentFor([hero]), viewport), hero)
  assert.equal(findSiteSearch(documentFor([hero, detail]), viewport), hero)
})

test('rune page intercepts Ctrl+F and selects its search field', () => {
  const field = input('rune'),
    event = key()
  handleFindShortcut(event, () => {}, documentFor([field]), viewport)
  assert.equal(event.defaultPrevented, true)
  assert.deepEqual(
    field.calls.map(call => call[0]),
    ['focus', 'select', 'scroll'],
  )
})
test('chooses the viewed detail, including team and standalone detail contexts', () => {
  const hero = input('hero'),
    old = input('detail', -700, 100),
    current = input('detail', 100, 900)
  assert.equal(findSiteSearch(documentFor([hero, old, current]), viewport), current)
  assert.equal(findSiteSearch(documentFor([hero, old, current], old), viewport), old)
  assert.equal(findSiteSearch(documentFor([current]), viewport), current)
  assert.equal(
    findSiteSearch(documentFor([input('detail', -1800, -300)]), viewport)?.dataset.siteSearch,
    'detail',
  )
})
test('Ctrl+F and Command+F prevent native find and focus/select existing text', () => {
  for (const modifiers of [{ ctrlKey: true }, { ctrlKey: false, metaKey: true }]) {
    const field = input('hero'),
      event = key(modifiers)
    let interrupted = 0
    handleFindShortcut(event, () => interrupted++, documentFor([field]), viewport)
    assert.equal(event.defaultPrevented, true)
    assert.equal(interrupted, 1)
    assert.deepEqual(field.calls, [
      ['focus', { preventScroll: true }],
      ['select'],
      ['scroll', { block: 'nearest', inline: 'nearest', behavior: 'instant' }],
    ])
  }
})
test('other shortcuts, IME and missing inputs leave browser behavior alone', () => {
  for (const overrides of [
    { ctrlKey: false },
    { shiftKey: true },
    { altKey: true },
    { isComposing: true },
    { key: 'g' },
    { defaultPrevented: true },
  ]) {
    const field = input('hero'),
      event = key(overrides)
    handleFindShortcut(event, () => {}, documentFor([field]), viewport)
    assert.equal(field.calls.length, 0)
  }
  const event = key()
  handleFindShortcut(event, () => {}, documentFor([]), viewport)
  assert.equal(event.defaultPrevented, false)
})

test('Escape on body closes the viewed detail once and dismisses its tooltip', () => {
  let clicks = 0,
    tips = 0,
    stopped = false
  const button = { disabled: false, getClientRects: () => [{}], click: () => clicks++ }
  const panel = {
    querySelector: selector => (selector === 'button.build-detail-close' ? button : null),
    getBoundingClientRect: () => ({ top: 0, bottom: 900, left: 0, right: 1000 }),
    contains: () => false,
  }
  const field = { ...input('detail'), closest: () => panel }
  const root = {
    activeElement: { closest: () => null, matches: () => false },
    querySelectorAll: selector => (selector.startsWith('button') ? [button] : [field]),
  }
  const event = key({
    key: 'Escape',
    ctrlKey: false,
    repeat: false,
    stopPropagation() {
      stopped = true
    },
  })
  handleDetailEscape(event, () => tips++, root, viewport)
  assert.equal(clicks, 1)
  assert.equal(tips, 1)
  assert.equal(stopped, true)
  assert.equal(event.defaultPrevented, true)
})

test('Escape with focus outside main still closes a detail, but ignores IME and held keys', () => {
  let clicks = 0
  const button = { disabled: false, getClientRects: () => [{}], click: () => clicks++ }
  const root = {
    activeElement: { closest: () => null, matches: () => false },
    querySelectorAll: selector => (selector.startsWith('button') ? [button] : []),
  }
  for (const overrides of [{ isComposing: true }, { repeat: true }, { key: 'Enter' }]) {
    handleDetailEscape(
      key({ key: 'Escape', ctrlKey: false, stopPropagation() {}, ...overrides }),
      () => {},
      root,
      viewport,
    )
  }
  assert.equal(clicks, 0)
  handleDetailEscape(
    key({ key: 'Escape', ctrlKey: false, stopPropagation() {} }),
    () => {},
    root,
    viewport,
  )
  assert.equal(clicks, 1)
  const event = key({ key: 'Escape', ctrlKey: false, stopPropagation() {} })
  handleDetailEscape(event, () => {}, documentFor([]), viewport)
  assert.equal(event.defaultPrevented, false)
})

test('Escape in any site search is reserved for SearchBox, even when already empty', () => {
  for (const scope of ['hero', 'detail', 'rune'])
    for (const value of ['凯尔', '']) {
      let clicks = 0,
        tips = 0,
        stopped = false
      const field = {
        value,
        dataset: { siteSearch: scope },
        matches: selector => selector === 'input[data-site-search]',
      }
      const button = { disabled: false, getClientRects: () => [{}], click: () => clicks++ }
      const root = { activeElement: field, querySelectorAll: () => [button] }
      const event = key({
        key: 'Escape',
        ctrlKey: false,
        stopPropagation() {
          stopped = true
        },
      })
      handleDetailEscape(event, () => tips++, root, viewport)
      assert.equal(clicks, 0)
      assert.equal(tips, 0)
      // The capture handler must let the shared input handler clear its Vue model.
      assert.equal(stopped, false)
      assert.equal(event.defaultPrevented, false)
    }
})

test('Escape collapses hero changes before closing inline details; standalone details also collapse', () => {
  for (const standalone of [false, true])
    for (const focused of [false, true]) {
      let expanded = true,
        closed = 0,
        collapsed = 0
      const close = { disabled: false, getClientRects: () => [{}], click: () => closed++ }
      const toggle = {
        disabled: false,
        getClientRects: () => [{}],
        click: () => {
          expanded = false
          collapsed++
        },
      }
      const panel = {
        querySelector: selector =>
          selector === 'button.build-detail-close'
            ? standalone
              ? null
              : close
            : selector === '[data-detail-patches] .detail-section-toggle[aria-expanded="true"]' &&
                expanded
              ? toggle
              : null,
        getBoundingClientRect: () => ({ top: 0, bottom: 900, left: 0, right: 1000 }),
        contains: () => focused,
      }
      const field = { ...input('detail'), closest: () => panel }
      const root = {
        activeElement: { closest: () => (focused ? panel : null), matches: () => false },
        querySelectorAll: selector =>
          selector.startsWith('button') ? (standalone ? [] : [close]) : [field],
      }
      const event = () =>
        key({ key: 'Escape', ctrlKey: false, repeat: false, stopPropagation() {} })
      const first = event()
      handleDetailEscape(first, () => {}, root, viewport)
      assert.equal(first.defaultPrevented, true)
      assert.equal(collapsed, 1)
      assert.equal(closed, 0)
      handleDetailEscape(event(), () => {}, root, viewport)
      assert.equal(collapsed, 1)
      assert.equal(closed, standalone ? 0 : 1)
    }
})

test('rune details reuse Escape collapse and close without requiring a detail search input', () => {
  for (const standalone of [false, true])
    for (const focused of [false, true]) {
      let expanded = true,
        closed = 0,
        collapsed = 0
      const close = { disabled: false, getClientRects: () => [{}], click: () => closed++ }
      const toggle = {
        disabled: false,
        getClientRects: () => [{}],
        click: () => {
          expanded = false
          collapsed++
        },
      }
      const panel = {
        querySelector: selector =>
          selector === 'button.build-detail-close'
            ? standalone
              ? null
              : close
            : selector === '[data-detail-patches] .detail-section-toggle[aria-expanded="true"]' &&
                expanded
              ? toggle
              : null,
        getBoundingClientRect: () => ({ top: 0, bottom: 900, left: 0, right: 1000 }),
      }
      const offscreen = {
        ...panel,
        getBoundingClientRect: () => ({ top: 1000, bottom: 1900, left: 0, right: 1000 }),
        querySelector: () => {
          throw new Error('must not act on an offscreen rune')
        },
      }
      const root = {
        activeElement: { closest: () => (focused ? panel : null), matches: () => false },
        querySelectorAll: selector =>
          selector === '.rune-detail'
            ? [offscreen, panel]
            : selector === 'button.build-detail-close'
              ? standalone
                ? []
                : [close]
              : [],
      }
      const event = () =>
        key({ key: 'Escape', ctrlKey: false, repeat: false, stopPropagation() {} })
      handleDetailEscape(event(), () => {}, root, viewport)
      assert.equal(collapsed, 1)
      assert.equal(closed, 0)
      handleDetailEscape(event(), () => {}, root, viewport)
      assert.equal(collapsed, 1)
      assert.equal(closed, standalone ? 0 : 1)
    }
})

test('search discovery identifies the focused search or defaults to the card filter', () => {
  const hero = input('hero'),
    detail = input('detail')
  const panel = detail.closest()
  hero.closest = () => panel
  assert.equal(findSiteSearch(documentFor([hero, detail]), viewport), detail)
  assert.equal(findSiteSearch(documentFor([hero, detail], hero), viewport), hero)
  assert.equal(findSiteSearch(documentFor([hero, detail], detail), viewport), detail)
})

test('Ctrl+F cycles within the current detail, selects text, and skips other or unavailable fields', () => {
  const board = input('hero'),
    hero = input('hero'),
    detail = input('detail'),
    other = input('detail'),
    disabled = input('hero'),
    hidden = input('hero')
  const panel = detail.closest()
  for (const field of [hero, disabled, hidden]) field.closest = () => panel
  disabled.disabled = true
  hidden.getClientRects = () => []
  const root = documentFor([board, hero, disabled, hidden, detail, other])
  for (const field of [hero, detail]) {
    field.value = field === hero ? 'timo' : 'hgjbg'
    const original = field.focus
    field.focus = options => {
      root.activeElement = field
      original(options)
    }
  }
  // First press outside a field keeps the established default: the card filter.
  handleFindShortcut(key(), () => {}, root, viewport)
  assert.equal(root.activeElement, detail)
  for (const expected of [hero, detail, hero, detail]) {
    const event = key()
    handleFindShortcut(event, () => {}, root, viewport)
    assert.equal(event.defaultPrevented, true)
    assert.equal(root.activeElement, expected)
    assert.equal(expected.calls.at(-2)[0], 'select')
  }
  assert.equal(hero.value, 'timo')
  assert.equal(detail.value, 'hgjbg')
  for (const field of [board, other, disabled, hidden]) assert.equal(field.calls.length, 0)
  const held = key({ repeat: true })
  handleFindShortcut(held, () => {}, root, viewport)
  assert.equal(held.defaultPrevented, true)
  assert.equal(root.activeElement, detail)
  handleFindShortcut(key({ ctrlKey: false, metaKey: true }), () => {}, root, viewport)
  assert.equal(root.activeElement, hero)
})

test('a detail with one available search keeps focus rather than cycling to the board', () => {
  const board = input('hero'),
    detail = input('detail'),
    root = documentFor([board, detail], detail)
  handleFindShortcut(key(), () => {}, root, viewport)
  assert.equal(board.calls.length, 0)
  assert.deepEqual(
    detail.calls.map(call => call[0]),
    ['focus', 'select', 'scroll'],
  )
})

test('up/down cycle the same detail fields; board suggestions, IME and modified arrows stay untouched', () => {
  const hero = input('hero'),
    detail = input('detail'),
    board = input('hero'),
    other = input('detail')
  hero.closest = () => detail.closest()
  const root = documentFor([board, hero, detail, other], hero)
  for (const field of [hero, detail]) {
    const original = field.focus
    field.focus = options => {
      root.activeElement = field
      original(options)
    }
  }
  for (const [keyName, expected] of [
    ['ArrowDown', detail],
    ['ArrowUp', hero],
    ['ArrowUp', detail],
    ['ArrowDown', hero],
  ]) {
    let stopped = false
    const event = key({
      key: keyName,
      ctrlKey: false,
      currentTarget: root.activeElement,
      stopPropagation() {
        stopped = true
      },
    })
    assert.equal(handleSearchArrow(event, root), true)
    assert.equal(root.activeElement, expected)
    assert.equal(event.defaultPrevented, true)
    assert.equal(stopped, true)
    assert.equal(expected.calls.at(-2)[0], 'select')
  }
  for (const overrides of [
    { currentTarget: board },
    { isComposing: true },
    { keyCode: 229 },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
    { metaKey: true },
    { key: 'ArrowLeft' },
    { key: 'ArrowRight' },
  ]) {
    const event = key({ key: 'ArrowDown', ctrlKey: false, currentTarget: hero, ...overrides })
    assert.equal(handleSearchArrow(event, root), false)
    assert.equal(event.defaultPrevented, false)
  }
  const repeat = key({
    key: 'ArrowDown',
    ctrlKey: false,
    currentTarget: hero,
    repeat: true,
    stopPropagation() {},
  })
  assert.equal(handleSearchArrow(repeat, root), true)
  assert.equal(root.activeElement, hero)
  assert.equal(board.calls.length, 0)
  assert.equal(other.calls.length, 0)
  const single = key({ key: 'ArrowDown', ctrlKey: false, currentTarget: detail })
  assert.equal(handleSearchArrow(single, documentFor([detail])), false)
})

test('nonempty detail searches keep up/down for candidates or caret; both peers must be empty', () => {
  const hero = input('hero'),
    detail = input('detail'),
    root = documentFor([hero, detail], hero)
  hero.closest = () => detail.closest()
  for (const field of [hero, detail])
    for (const text of ['tm', 'hgjbg', ' '])
      for (const arrow of ['ArrowUp', 'ArrowDown']) {
        field.value = text
        const event = key({
          key: arrow,
          ctrlKey: false,
          currentTarget: field,
          stopPropagation() {
            throw new Error('must reach the existing key handler')
          },
        })
        assert.equal(handleSearchArrow(event, root), false)
        assert.equal(event.defaultPrevented, false)
      }
  hero.value = ''
  detail.value = 'hgjbg'
  assert.equal(
    handleSearchArrow(
      key({ key: 'ArrowDown', ctrlKey: false, currentTarget: hero, stopPropagation() {} }),
      root,
    ),
    false,
  )
  assert.deepEqual(detail.calls, [])
  assert.equal(detail.value, 'hgjbg')
})

test('top navigation and hero detail share shortcut cycling across separate DOM parents', () => {
  const hero = input('hero'),
    detail = input('detail'),
    unrelated = input('detail')
  const group = { getAttribute: () => 'hero-board' }
  for (const field of [hero, detail]) {
    const closest = field.closest
    field.closest = selector => (selector === '[data-search-group]' ? group : closest(selector))
  }
  const root = documentFor([hero, detail, unrelated], hero)
  for (const field of [hero, detail])
    field.focus = () => {
      root.activeElement = field
    }
  for (const expected of [detail, hero, detail, hero]) {
    handleFindShortcut(key(), () => {}, root, viewport)
    assert.equal(root.activeElement, expected)
  }
  for (const [keyName, expected] of [
    ['ArrowDown', detail],
    ['ArrowUp', hero],
  ]) {
    assert.equal(
      handleSearchArrow(
        key({
          key: keyName,
          ctrlKey: false,
          currentTarget: root.activeElement,
          stopPropagation() {},
        }),
        root,
      ),
      true,
    )
    assert.equal(root.activeElement, expected)
  }
  for (const field of [hero, detail]) {
    field.value = 'a'
    assert.equal(
      handleSearchArrow(key({ key: 'ArrowDown', ctrlKey: false, currentTarget: hero }), root),
      false,
    )
    assert.equal(
      handleSearchArrow(key({ key: 'ArrowUp', ctrlKey: false, currentTarget: detail }), root),
      false,
    )
    field.value = ''
  }
  hero.value = 'ys'
  detail.value = 'ylk'
  handleFindShortcut(key(), () => {}, root, viewport)
  assert.equal(root.activeElement, detail)
  assert.equal(hero.value, 'ys')
  assert.equal(detail.value, 'ylk')
  assert.equal(unrelated.calls.length, 0)
})

test('Ctrl+F first visit, remembered focus, cycling and reopened detail follow separate states', () => {
  const hero = input('hero'),
    detail = input('detail'),
    group = { getAttribute: () => 'hero-board' }
  for (const field of [hero, detail]) {
    const closest = field.closest
    field.closest = selector => (selector === '[data-search-group]' ? group : closest(selector))
  }
  const fields = [hero, detail],
    root = documentFor(fields)
  for (const field of fields)
    field.focus = () => {
      root.activeElement = field
      rememberSearchFocus(field, root)
    }
  // A mouse focus before the first Ctrl+F does not override the initial target.
  hero.focus()
  root.activeElement = null
  handleFindShortcut(key(), () => {}, root, viewport)
  assert.equal(root.activeElement, detail)
  handleFindShortcut(key(), () => {}, root, viewport)
  assert.equal(root.activeElement, hero)
  root.activeElement = null
  handleFindShortcut(key(), () => {}, root, viewport)
  assert.equal(root.activeElement, hero)
  // Mouse/Tab focus after the first shortcut updates the remembered field too.
  detail.focus()
  root.activeElement = null
  handleFindShortcut(key(), () => {}, root, viewport)
  assert.equal(root.activeElement, detail)
  hero.focus()
  root.activeElement = null
  // Closing/reopening supplies a new panel; old focus must not leak into it.
  const reopened = input('detail'),
    closest = reopened.closest
  reopened.closest = selector => (selector === '[data-search-group]' ? group : closest(selector))
  fields[1] = reopened
  reopened.focus = () => {
    root.activeElement = reopened
    rememberSearchFocus(reopened, root)
  }
  handleFindShortcut(key(), () => {}, root, viewport)
  assert.equal(root.activeElement, reopened)
  // Starting while already in a field always switches, even in a fresh session.
  const fresh = input('detail'),
    panel = fresh.closest(),
    other = input('hero')
  other.closest = () => panel
  const second = documentFor([other, fresh], other)
  fresh.focus = () => {
    second.activeElement = fresh
  }
  handleFindShortcut(key(), () => {}, second, viewport)
  assert.equal(second.activeElement, fresh)
})

test('shortcut preview matches execution without consuming the first press', () => {
  const hero = input('hero'),
    detail = input('detail')
  hero.closest = () => detail.closest()
  const root = documentFor([hero, detail])
  for (let i = 0; i < 3; i++) {
    const next = nextFindTarget(root, viewport)
    assert.equal(next.input, detail)
    assert.equal(next.switching, false)
    assert.equal(next.session.usedFind, false)
  }
  handleFindShortcut(key(), () => {}, root, viewport)
  root.activeElement = detail
  assert.equal(nextFindTarget(root, viewport).input, hero)
  assert.equal(nextFindTarget(root, viewport).switching, true)
  rememberSearchFocus(hero, root)
  root.activeElement = null
  assert.equal(nextFindTarget(root, viewport).input, hero)
  assert.equal(nextFindTarget(root, viewport).switching, false)
})

test('rune board and detail reuse shortcut targets, hints and empty-arrow cycling', () => {
  const board = input('rune'),
    detail = input('detail'),
    group = { getAttribute: () => 'rune-board' }
  for (const field of [board, detail]) {
    const closest = field.closest
    field.closest = selector => (selector === '[data-search-group]' ? group : closest(selector))
  }
  const root = documentFor([board, detail])
  root.querySelector = selector =>
    selector === '.rune-detail' ? detail.closest('.build-detail') : null
  for (const field of [board, detail])
    field.focus = () => {
      root.activeElement = field
      rememberSearchFocus(field, root)
    }
  assert.equal(nextFindTarget(root, viewport).input, detail)
  handleFindShortcut(key(), () => {}, root, viewport)
  assert.equal(root.activeElement, detail)
  for (const expected of [board, detail, board]) {
    assert.equal(nextFindTarget(root, viewport).input, expected)
    assert.equal(nextFindTarget(root, viewport).switching, true)
    const event = key()
    handleFindShortcut(event, () => {}, root, viewport)
    assert.equal(event.defaultPrevented, true)
    assert.equal(root.activeElement, expected)
  }
  assert.equal(
    handleSearchArrow(
      key({ key: 'ArrowDown', ctrlKey: false, currentTarget: board, stopPropagation() {} }),
      root,
    ),
    true,
  )
  assert.equal(root.activeElement, detail)
  detail.value = 'jrss'
  root.activeElement = null
  handleFindShortcut(key(), () => {}, root, viewport)
  assert.equal(root.activeElement, detail)
  assert.equal(detail.value, 'jrss')
})
