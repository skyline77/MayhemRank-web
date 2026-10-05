import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { loadTS, scriptSetup, stripImports } from './load-ts.mjs'
const { normalizeSearch, matchesSearch } = await loadTS('../src/search.ts')
test('cached search retains Unicode, empty queries and changed labels after eviction', () => {
  assert.equal(normalizeSearch(' ＡＢ，Ｃ '), 'abc')
  assert.ok(matchesSearch(['疾风剑豪', 'YASUO'], ' ＹＡ '))
  assert.ok(matchesSearch(['旧名'], ''))
  for (let i = 0; i < 4200; i++) normalizeSearch('候选' + i)
  assert.equal(normalizeSearch(' ＡＢ，Ｃ '), 'abc')
  assert.ok(!matchesSearch(['新名'], '旧名'))
})
test('hero selection reuses theme and only updates series; zoom dispatches without rebuilding', () => {
  const script = ts.transpile(stripImports(scriptSetup('../src/RuneHeroChart.vue')), {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  })
  const calls = [],
    actions = [],
    watchers = []
  const sandbox = {
    locale: { value: 'zh-CN' },
    defineProps: () => ({ data: { entries: [], meta: {} } }),
    ref: v => ({ value: v }),
    computed: f => ({
      get value() {
        return f()
      },
    }),
    watch: (s, f) => watchers.push(f),
    onMounted: () => {},
    onBeforeUnmount: () => {},
    DEFAULT_RUNE_HERO_MIN_GAMES: 50,
    chartHeroes: () => [],
    heroChartBounds: () => ({ xMax: 1, yMin: 0, yMax: 1 }),
  }
  vm.createContext(sandbox)
  vm.runInContext(
    script +
      `;host.value={};cachedTheme={colors:[]};chart={setOption:(o)=>calls.push(o),dispatchAction:a=>actions.push(a)};runtime={heroChartOption:()=>({series:[{id:'hero-arrows'}],xAxis:{}})};select('1');zoomBy(.6);reset();`,
    Object.assign(sandbox, { calls, actions }),
  )
  assert.equal(calls.length, 1)
  assert.deepEqual(Object.keys(calls[0]), ['series'])
  assert.equal(actions.length, 2)
  assert.equal(actions[0].type, 'dataZoom')
  assert.equal(actions[1].batch[0].start, 0)
  assert.equal(actions[1].batch[0].end, 100)
})

test('navigation reuses targets and skips identical opacity writes, refreshing after invalidation', () => {
  const script = ts.transpile(
    stripImports(scriptSetup('../src/BoardNavigation.vue')).replace(
      /^const wordmark\w*\s*=.*$/gm,
      '',
    ),
    { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  )
  let queries = 0,
    writes = 0,
    top = 300
  const sandbox = {
    defineEmits: () => () => {},
    ref: v => ({ value: v }),
    onMounted: () => {},
    onUnmounted: () => {},
    window: { innerWidth: 1200, scrollY: 0 },
    navigationInset: () => 60,
    requestAnimationFrame: () => 1,
    fakeNav: { style: { setProperty: () => writes++ } },
    fakeMain: {
      style: { setProperty: () => writes++ },
      querySelector: selector => {
        queries++
        return selector.includes('art')
          ? { isConnected: true, offsetHeight: 279 }
          : {
              isConnected: true,
              closest: () => null,
              getBoundingClientRect: () => ({ top, height: 50 }),
            }
      },
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(
    script + ';nav.value=fakeNav;main=fakeMain;updateOpacity();updateOpacity();',
    sandbox,
  )
  assert.equal(queries, 2)
  assert.equal(writes, 1)
  top = 60
  sandbox.window.scrollY = 240
  vm.runInContext('updateOpacity();updateOpacity()', sandbox)
  assert.equal(queries, 2)
  assert.equal(writes, 2)
  vm.runInContext('invalidateOpacity();updateOpacity()', sandbox)
  assert.equal(queries, 4)
  assert.equal(writes, 2)
})
