import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { pageWindow } = await loadTS('../src/details/detailPagination.ts')
test('pagination clamps after filtering and retains a partial final page', () => {
  assert.deepEqual(pageWindow(77, 2, 8), { page: 2, pages: 10, start: 8, end: 16 })
  assert.deepEqual(pageWindow(77, 10, 8), { page: 10, pages: 10, start: 72, end: 77 })
  assert.deepEqual(pageWindow(3, 10, 8), { page: 1, pages: 1, start: 0, end: 3 })
  assert.deepEqual(pageWindow(0, 1, 8), { page: 1, pages: 1, start: 0, end: 0 })
})
test('changing responsive page size never creates gaps or duplicates', () => {
  for (const size of [2, 6, 8, 12]) {
    const seen = []
    for (let page = 1; page <= pageWindow(77, 1, size).pages; page++) {
      const range = pageWindow(77, page, size)
      for (let i = range.start; i < range.end; i++) seen.push(i)
    }
    assert.deepEqual(
      seen,
      Array.from({ length: 77 }, (_, i) => i),
    )
  }
})
