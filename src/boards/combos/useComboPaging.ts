// 组合榜的分页方式：>800px 每页 10 条、上下翻页；≤800px 初始 20 条，
// 底部哨兵进入视口下方 120px 范围时从已返回结果中再追加 20 条（不另发请求）。
import { computed, onMounted, onUnmounted, ref, watch, nextTick, type Ref } from 'vue'

const pageSize = 10,
  mobileStep = 20

export function useComboPaging<T>(
  rows: Ref<T[]>,
  /** 加载中或出错时不翻页、不追加 */
  blocked: () => boolean,
  list: Ref<HTMLElement | null>,
) {
  const page = ref(1)
  const mobileQuery = window.matchMedia('(max-width:800px)')
  const mobile = ref(mobileQuery.matches),
    mobileLimit = ref(mobileStep)
  const sentinel = ref<HTMLElement | null>(null)
  let observer: IntersectionObserver | undefined

  function updateViewport() {
    mobile.value = mobileQuery.matches
    page.value = 1
    mobileLimit.value = mobileStep
  }
  onMounted(() => {
    mobileQuery.addEventListener('change', updateViewport)
  })
  watch(
    sentinel,
    element => {
      observer?.disconnect()
      if (!element) return
      observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting) && mobile.value && !blocked()) {
            mobileLimit.value = Math.min(rows.value.length, mobileLimit.value + mobileStep)
          }
        },
        { rootMargin: '0px 0px 120px 0px' },
      )
      observer.observe(element)
    },
    { flush: 'post' },
  )

  const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize)))
  const pageStart = computed(() => (page.value - 1) * pageSize)
  /** 当前显示的行在 rows 中的范围 [start, end) */
  const visibleStart = computed(() => (mobile.value ? 0 : pageStart.value))
  const visibleEnd = computed(() => (mobile.value ? mobileLimit.value : pageStart.value + pageSize))
  // 新结果回到第一页或前 20 条
  watch(rows, () => {
    page.value = 1
    mobileLimit.value = mobileStep
  })

  /** 底部翻页：切页后聚焦并滚动到列表顶部；减少动态效果时即时定位 */
  async function turnPageFromBottom(direction: number) {
    const target = Math.max(1, Math.min(pageCount.value, page.value + direction))
    if (blocked() || target === page.value) return
    page.value = target
    await nextTick()
    list.value?.focus({ preventScroll: true })
    list.value?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
  }

  onUnmounted(() => {
    observer?.disconnect()
    mobileQuery.removeEventListener('change', updateViewport)
  })

  return {
    page,
    pageCount,
    mobile,
    mobileLimit,
    sentinel,
    visibleStart,
    visibleEnd,
    turnPageFromBottom,
  }
}
