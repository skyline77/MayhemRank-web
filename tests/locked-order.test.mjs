import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { reconcileLockedOrder, matchingScrollOffset } = await loadTS('../src/lockedOrder.ts')
const cell = (id, games) => ({ id, games })
const missing = cell => ({ ...cell, games: 0, missing: true })
test('keeps locked order while using new statistics and appending new entries', () => {
  const previous = [cell('a', 100), cell('b', 80)]
  const current = [cell('c', 300), cell('b', 200), cell('a', 10)]
  assert.deepEqual(reconcileLockedOrder(previous, current, missing), [
    cell('a', 10),
    cell('b', 200),
    cell('c', 300),
  ])
  assert.deepEqual(previous, [cell('a', 100), cell('b', 80)])
})
test('missing cards keep their position, never stale statistics, and recover when present', () => {
  const frozen = reconcileLockedOrder([cell('a', 100), cell('b', 80)], [cell('b', 20)], missing)
  assert.deepEqual(frozen, [{ id: 'a', games: 0, missing: true }, cell('b', 20)])
  assert.deepEqual(reconcileLockedOrder(frozen, [cell('b', 10), cell('a', 30)], missing), [
    cell('a', 30),
    cell('b', 10),
  ])
})
test('retained spell pairs below display thresholds use available statistics, without appending hidden pairs', () => {
  assert.deepEqual(
    reconcileLockedOrder([cell('a', 100), cell('b', 10)], [cell('a', 50)], missing, [
      cell('a', 50),
      cell('b', 1),
      cell('hidden', 1),
    ]),
    [cell('a', 50), cell('b', 1)],
  )
})
test('visible matches or no matches retain scroll; hidden matches align first match left', () => {
  const view = { left: 100, right: 400 }
  assert.equal(matchingScrollOffset(view, [], 200), null)
  assert.equal(
    matchingScrollOffset(
      view,
      [
        { left: 0, right: 72 },
        { left: 200, right: 272 },
      ],
      200,
    ),
    null,
  )
  assert.equal(matchingScrollOffset(view, [{ left: 500, right: 572 }], 200), 600)
  assert.equal(matchingScrollOffset(view, [{ left: 50, right: 122 }], 200), 150)
  assert.equal(matchingScrollOffset(view, [{ left: 370, right: 442 }], 200), 470)
})
