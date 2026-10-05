// 站内路由：三个榜单共用一个页面，按 URL 的 page / champion / rune 参数决定显示哪个榜单。
// 站内切换时更新 URL 与版本，重新挂载榜单（routeKey），并由 pageHistory 恢复滚动与视图状态。
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { selectedPatch, selectedVersion, defaultVersion } from '@/data/versions'
import { dataPatch } from '@/data/versionSelection'
import { closeTip } from '@/tooltip/tooltip'
import { cancelDetailTransition } from '@/details/detailScroll'
import { boardLink } from './detailLink'
import {
  readHistorySection,
  registerHistorySection,
  saveView,
  preparePageHistory,
  installPageHistory,
} from './pageHistory'

function selectVersion(version: string) {
  selectedVersion.value = version
  selectedPatch.value = dataPatch(version)
}

/** 浏览器前进／后退回到本页时，恢复当时选择的版本。 */
export function restoreHistoryPatch() {
  const saved = readHistorySection<{ patch: string }>('app')
  if (saved?.patch) selectVersion(saved.patch)
  onUnmounted(registerHistorySection('app', () => ({ patch: selectedVersion.value })))
}

export function useSiteRouting() {
  const destination = ref(boardLink(location.search))
  /** 每次站内切换递增，用作榜单组件的 key 以重新挂载 */
  const routeKey = ref(0)

  // 旧版详情链接只有 champion / rune 参数时，补上对应的 page。
  const query = new URLSearchParams(location.search)
  if (
    (destination.value.champion || destination.value.rune) &&
    query.get('page') !== destination.value.page
  ) {
    query.set('page', destination.value.page)
    history.replaceState(history.state, '', location.pathname + '?' + query + location.hash)
  }

  /** 导航链接：默认的英雄榜与默认版本不写入 URL */
  function pageHref(page: string) {
    const params = new URLSearchParams()
    if (page !== 'heroes') params.set('page', page)
    if (
      selectedVersion.value &&
      (page !== 'heroes' || selectedVersion.value !== defaultVersion.value)
    )
      params.set('patch', selectedVersion.value)
    return '/' + (params.size ? '?' + params : '')
  }

  let stopHistoryRestore: (() => void) | undefined
  let routeSerial = 0
  /** 站内切换到 href；不传 href 表示浏览器前进／后退已经改变了地址 */
  async function changePage(href?: string) {
    const serial = ++routeSerial
    closeTip()
    cancelDetailTransition()
    stopHistoryRestore?.()
    if (href) {
      saveView()
      history.pushState({}, '', href)
    }
    preparePageHistory(!href)
    const patch = new URLSearchParams(location.search).get('patch') || defaultVersion.value
    if (patch) selectVersion(patch)
    destination.value = boardLink(location.search)
    routeKey.value++
    await nextTick()
    if (serial !== routeSerial) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    stopHistoryRestore = installPageHistory()
    window.dispatchEvent(new Event('resize'))
  }

  /** 在 onMounted 中开始监听浏览器前进／后退（调用方决定挂载顺序） */
  function listen() {
    const popPage = () => void changePage()
    onMounted(() => {
      stopHistoryRestore = installPageHistory()
      window.addEventListener('popstate', popPage)
    })
    onUnmounted(() => {
      window.removeEventListener('popstate', popPage)
      stopHistoryRestore?.()
    })
  }

  const page = computed(() => destination.value.page)
  return { destination, page, routeKey, pageHref, changePage, listen }
}
