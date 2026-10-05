import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { cardGrid, categoryGridVars, indicatorSpan, highlightClip } = await loadTS(
  '../src/details/categoryTabsGeometry.ts',
)

test('card grid keeps 76px cards with outer margins of two gaps', () => {
  assert.deepEqual(cardGrid(343), { columns: 4, gap: (343 - 4 * 76) / 7 })
  const { columns, gap } = cardGrid(500)
  assert.equal(columns, 6)
  assert.ok(Math.abs(columns * 76 + gap * (columns + 3) - 500) < 1e-9)
  assert.deepEqual(cardGrid(40), { columns: 1, gap: 0 })
})

test('pager insets align with the second and last tab labels', () => {
  const bounds = [
    { left: 10, width: 28 },
    { left: 80, width: 28 },
    { left: 150, width: 28 },
  ]
  const vars = categoryGridVars(300, bounds)
  assert.equal(vars['--pager-start-inset'], 80 - 60 + 'px')
  assert.equal(vars['--pager-end-inset'], 300 - 178 + 'px')
  assert.equal(vars['--mobile-columns'], '3')
  assert.equal(vars['--mobile-pair-width'], (300 - 5 * cardGrid(300).gap) / 2 + 'px')
})

test('indicator interpolates between neighbouring labels and clamps at the ends', () => {
  const bounds = [
    { left: 0, width: 20 },
    { left: 100, width: 40 },
  ]
  assert.deepEqual(indicatorSpan(bounds, 0.5), { left: 50, width: 30 })
  assert.deepEqual(indicatorSpan(bounds, -1), { left: 0, width: 20 })
  assert.deepEqual(indicatorSpan(bounds, 3), { left: 100, width: 40 })
})

test('highlight clip covers only the part under the indicator', () => {
  const text = { left: 100, width: 40 }
  assert.equal(highlightClip(text, { left: 110, width: 20 }), 'inset(0 10px 0 10px)')
  assert.equal(highlightClip(text, { left: 0, width: 20 }), 'inset(0 40px 0 0px)')
})
