import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import { ref, computed, watch, nextTick, effectScope, reactive } from 'vue'
import { loadTS, scriptSetup, stripImports } from './load-ts.mjs'
const setup = stripImports(scriptSetup('../src/details/hero/BuildDetail.vue'))
const compiled = ts.transpile(
  setup +
    '\nreturn {entry,roles,filter,changeFilter,detail,baseline,loading,error,load,displayedFilter,initialLoading,scopeName,displayedPatch,allSortData}',
  { target: ts.ScriptTarget.ES2022 },
)
const { championBuilds } = await loadTS('../src/boards/heroes/buildBoard.ts')
const { t: translate, message } = await loadTS('../src/i18n/i18n.ts')
const { heroFilter } = await loadTS('../src/details/hero/heroFilter.ts')
const heroDetailGroups = await loadTS('../src/details/hero/heroDetailGroups.ts')
const settle = async () => {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}
function harness(t, delayed = false) {
  const entries = [
    {
      id: '57:AP',
      championId: 57,
      name: '茂凯',
      role: 'AP',
      games: 20,
      winRate: 0.7,
      eligibleGames: 150,
    },
    {
      id: '57:tank',
      championId: 57,
      name: '茂凯',
      role: '坦克',
      games: 100,
      winRate: 0.5,
      eligibleGames: 150,
    },
    {
      id: '10:AP',
      championId: 10,
      name: '凯尔',
      role: 'AP',
      games: 200,
      winRate: 0.6,
      eligibleGames: 250,
    },
  ]
  const props = reactive({ entry: entries[0], entries, patch: '16.18', panelId: 'test' })
  const pending = [],
    events = [],
    unmount = [],
    scope = effectScope()
  const loadHeroDetail = async (entry, patch, filter) => {
    const n = filter.role ? entry.games : filter.rune ? 15 : filter.item ? 30 : 150,
      baseline = filter.role ? entry.winRate : 0.4
    const value = {
      championId: entry.championId,
      summary: { games: n, winRate: baseline },
      detail: { games: n, groups: {} },
      spells: { games: n },
      meta: { patch },
    }
    if (delayed)
      return new Promise((resolve, reject) =>
        pending.push({
          filter: { ...filter },
          patch,
          championId: entry.championId,
          resolve: () => resolve(value),
          reject,
        }),
      )
    return value
  }
  const env = {
    ref,
    computed,
    watch,
    nextTick,
    onUnmounted: fn => unmount.push(fn),
    onMounted: () => {},
    provide: () => {},
    rememberView: () => {},
    useCompactBoard: () => ref(false),
    locale: ref('zh-CN'),
    gameTitle: (_id, _patch, name) => name,
    gameName: (_kind, _id, _patch, name) => name,
    roleName: row => row.role,
    t: translate,
    message,
    formatCount: String,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    readHistorySection: () => undefined,
    registerHistorySection: () => () => {},
    usePatchAvailability: () => ref(true),
    defineProps: () => props,
    withDefaults: p => p,
    defineEmits:
      () =>
      (...args) =>
        events.push(args),
    championBuilds,
    heroFilter,
    closeTip: () => {},
    loadHeroDetail,
    ...heroDetailGroups,
    // 标题概览与字号适配不属于筛选切换的测试范围
    useHeroOverview: () => ({ allWinRate: ref(), allGames: ref(), otherStats: ref(null) }),
    useFittedHeading: () => {},
  }
  const run = new Function(...Object.keys(env), compiled)
  const app = scope.run(() => run(...Object.values(env)))
  const takeRequests = () => pending.splice(0)
  const resolveRequests = (requests = takeRequests()) =>
    requests.forEach(request => request.resolve())
  const rejectRequests = error => takeRequests().forEach(request => request.reject(error))
  const dispose = () => {
    unmount.splice(0).forEach(fn => fn())
    scope.stop()
  }
  t.after(dispose)
  return { ...app, props, pending, events, takeRequests, resolveRequests, rejectRequests, dispose }
}
const rune = { id: '7', name: '亮剑', icon: '/7.png' }
test('role switch preserves board anchor; repeated selected role clears to all appearances', async t => {
  const app = harness(t)
  await settle()
  assert.equal(app.entry.value.role, 'AP')
  app.changeFilter({ type: 'role', role: '坦克' })
  await settle()
  assert.equal(app.detail.value.games, 100)
  assert.equal(app.baseline.value, 0.5)
  assert.equal(app.props.entry.id, '57:AP')
  app.changeFilter({ type: 'role', role: '坦克' })
  await settle()
  assert.equal(app.filter.value.role, null)
  assert.equal(app.detail.value.games, 150)
  assert.equal(app.baseline.value, 0.4)
})
test('rune and role conditions are mutually exclusive; clicking a rune directly replaces the selected role', async t => {
  const app = harness(t)
  await settle()
  assert.equal(app.filter.value.role, 'AP')
  app.changeFilter({ type: 'rune', rune })
  await settle()
  assert.equal(app.detail.value.games, 15)
  app.changeFilter({ type: 'rune', rune })
  await settle()
  assert.equal(app.detail.value.games, 150)
  assert.deepEqual(app.filter.value, { role: null, rune: null })
  app.changeFilter({ type: 'rune', rune })
  app.changeFilter({ type: 'role', role: 'AP' })
  await settle()
  assert.deepEqual(app.filter.value, { role: 'AP', rune: null })
  assert.equal(app.detail.value.games, 20)
  // Standalone parent reflects the selected role without resetting the chosen filter.
  app.changeFilter({ type: 'role', role: '坦克' })
  app.props.entry = app.props.entries[1]
  await settle()
  assert.equal(app.detail.value.games, 100)
})
test('new champion or patch clears the previous rune selection', async t => {
  const app = harness(t)
  app.changeFilter({ type: 'rune', rune })
  app.props.entry = app.props.entries[2]
  await settle()
  assert.deepEqual(app.filter.value, { role: 'AP', rune: null })
  assert.equal(app.detail.value.games, 200)
  app.changeFilter({ type: 'rune', rune })
  await settle()
  app.props.patch = '16.19'
  await settle()
  assert.deepEqual(app.filter.value, { role: 'AP', rune: null })
})
test('late responses cannot replace the current filter; completed cards remain during loading', async t => {
  const app = harness(t, true)
  await nextTick()
  app.resolveRequests()
  await settle()
  assert.equal(app.detail.value.games, 20)
  app.changeFilter({ type: 'role', role: 'AP' })
  await nextTick()
  assert.equal(app.detail.value.games, 20)
  assert.equal(app.initialLoading.value, false)
  assert.equal(app.displayedFilter.value.role, 'AP')
  assert.equal(app.loading.value, true)
  const older = app.takeRequests()
  app.changeFilter({ type: 'rune', rune })
  await nextTick()
  app.resolveRequests()
  await settle()
  assert.equal(app.detail.value.games, 15)
  assert.equal(app.displayedFilter.value.rune.id, '7')
  app.resolveRequests(older)
  await settle()
  assert.equal(app.detail.value.games, 15)
  assert.equal(app.loading.value, false)
  assert.equal(app.error.value, '')
})
test('initial failure shows no stale values and retry loads the same selection', async t => {
  const app = harness(t, true)
  await nextTick()
  app.rejectRequests(new Error('offline'))
  await settle()
  assert.equal(app.detail.value, undefined)
  assert.equal(app.error.value, 'offline')
  const retry = app.load()
  await nextTick()
  app.resolveRequests()
  await retry
  assert.equal(app.detail.value.games, 20)
  assert.equal(app.error.value, '')
})

test('refreshing the same anchor object does not clear a rune or all-appearance selection', async t => {
  const app = harness(t)
  app.changeFilter({ type: 'rune', rune })
  await settle()
  app.props.entry = { ...app.props.entry }
  await settle()
  assert.equal(app.filter.value.rune.id, '7')
  app.changeFilter({ type: 'rune', rune })
  await settle()
  app.props.entry = { ...app.props.entry }
  await settle()
  assert.deepEqual(app.filter.value, { role: null, rune: null })
  assert.equal(app.detail.value.games, 150)
})

test('clicking another rune replaces the first without retaining a role or intersecting conditions', async t => {
  const app = harness(t)
  await settle()
  app.changeFilter({ type: 'rune', rune })
  await settle()
  const other = { id: '8', name: '另一符文', icon: '/8.png' }
  app.changeFilter({ type: 'rune', rune: other })
  await settle()
  assert.deepEqual(app.filter.value, { role: null, rune: other })
  app.changeFilter({ type: 'rune', rune: other })
  await settle()
  assert.deepEqual(app.filter.value, { role: null, rune: null })
  assert.equal(app.detail.value.games, 150)
})

test('equipment replaces role or rune, toggles off, and cannot collide with rune IDs', async t => {
  const app = harness(t)
  await settle()
  const item = { id: '7', name: '三相之力', icon: '/item.png' }
  app.changeFilter({ type: 'item', item })
  await settle()
  assert.equal(app.detail.value.games, 30)
  assert.deepEqual(app.filter.value, { role: null, rune: null, item })
  app.changeFilter({ type: 'rune', rune })
  await settle()
  assert.equal(app.detail.value.games, 15)
  assert.deepEqual(app.filter.value, { role: null, rune })
  app.changeFilter({ type: 'item', item })
  await settle()
  app.changeFilter({ type: 'item', item })
  await settle()
  assert.deepEqual(app.filter.value, { role: null, rune: null })
  assert.equal(app.detail.value.games, 150)
  app.changeFilter({ type: 'item', item })
  await settle()
  app.changeFilter({ type: 'role', role: 'AP' })
  await settle()
  assert.deepEqual(app.filter.value, { role: 'AP', rune: null })
  assert.equal(app.detail.value.games, 20)
  app.changeFilter({ type: 'item', item })
  await settle()
  app.props.patch = '16.19'
  await settle()
  assert.deepEqual(app.filter.value, { role: 'AP', rune: null })
})

test('late item response cannot overwrite a more recent rune filter', async t => {
  const app = harness(t, true)
  await nextTick()
  app.resolveRequests()
  await settle()
  app.changeFilter({ type: 'item', item: { id: '100', name: '装备', icon: '/item.png' } })
  await nextTick()
  const older = app.takeRequests()
  app.changeFilter({ type: 'rune', rune })
  await nextTick()
  app.resolveRequests()
  await settle()
  app.resolveRequests(older)
  await settle()
  assert.equal(app.detail.value.games, 15)
  assert.equal(app.filter.value.rune.id, '7')
})

test('failed refresh retains coherent completed data and retry commits the requested filter', async t => {
  const app = harness(t, true)
  await nextTick()
  app.resolveRequests()
  await settle()
  app.changeFilter({ type: 'rune', rune })
  await nextTick()
  assert.equal(app.detail.value.games, 20)
  assert.equal(app.displayedFilter.value.role, 'AP')
  app.rejectRequests(new Error('offline'))
  await settle()
  assert.equal(app.detail.value.games, 20)
  assert.equal(app.displayedFilter.value.role, 'AP')
  assert.equal(app.error.value, 'offline')
  assert.equal(app.loading.value, false)
  const retry = app.load()
  await nextTick()
  app.resolveRequests()
  await retry
  assert.equal(app.detail.value.games, 15)
  assert.equal(app.displayedFilter.value.rune.id, '7')
  assert.equal(app.error.value, '')
})

test('changing champion clears completed cards before the new hero arrives', async t => {
  const app = harness(t, true)
  await nextTick()
  app.resolveRequests()
  await settle()
  app.props.entry = app.props.entries[2]
  await nextTick()
  assert.equal(app.detail.value, undefined)
  assert.equal(app.initialLoading.value, true)
  app.resolveRequests()
  await settle()
  assert.equal(app.detail.value.games, 200)
})

test('same-hero version refresh retains the completed data and its version until an atomic replacement', async t => {
  for (const update of [
    app => (app.props.patch = '16.19'),
    app => {
      app.props.entries = app.props.entries.map(entry => ({ ...entry, snapshotId: 'new' }))
      app.props.entry = app.props.entries[0]
    },
  ]) {
    const app = harness(t, true)
    await nextTick()
    app.resolveRequests()
    await settle()
    const previous = app.detail.value
    update(app)
    await nextTick()
    assert.equal(app.detail.value, previous)
    assert.equal(app.initialLoading.value, false)
    assert.equal(app.displayedPatch.value, '16.18')
    assert.equal(app.loading.value, true)
    app.resolveRequests()
    await settle()
    assert.notEqual(app.detail.value, previous)
    assert.equal(app.displayedPatch.value, app.props.patch)
    assert.equal(app.loading.value, false)
  }
})

test('parent hero selection replaces the detail and clears filters without closing the panel', async t => {
  const app = harness(t)
  await settle()
  app.changeFilter({ type: 'rune', rune })
  await settle()
  app.props.entry = app.props.entries[2]
  await settle()
  assert.equal(app.entry.value.championId, 10)
  assert.equal(app.props.panelId, 'test')
  assert.deepEqual(app.filter.value, { role: 'AP', rune: null })
  assert.equal(app.detail.value.games, 200)
  assert.equal(
    app.events.some(([name]) => name === 'close'),
    false,
  )
})

test('selected cohort and all-appearance sort reference commit together', async t => {
  const app = harness(t, true)
  await nextTick()
  const requests = app.takeRequests()
  requests.filter(request => request.filter.role === 'AP').forEach(request => request.resolve())
  await settle()
  assert.equal(app.detail.value, undefined)
  assert.equal(app.allSortData.value, null)
  app.resolveRequests(requests)
  await settle()
  assert.equal(app.detail.value.games, 20)
  assert.equal(app.allSortData.value.summary.games, 150)
})

test('unmount invalidates pending detail responses', async t => {
  const app = harness(t, true)
  await nextTick()
  app.dispose()
  app.resolveRequests()
  await settle()
  assert.equal(app.detail.value, undefined)
  assert.equal(app.allSortData.value, null)
})
