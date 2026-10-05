import { t, message } from './i18n'
import { formatCount, formatCompactCount } from './formatCount'
import type { RuneSlot } from './augmentBoard'
import type { EChartsOption } from 'echarts'
export const runeChartPoints = (slots: readonly RuneSlot[]) =>
  slots.filter(p => p.slot >= 1 && p.slot <= 4).sort((a, b) => a.slot - b.slot)
export const runeChartTotal = (points: readonly RuneSlot[]) =>
  points.reduce((sum, p) => sum + p.games, 0)
export function runeRateRange(baseline: number) {
  const center = Math.round(baseline * 20) * 5
  return { min: (center - 10) / 100, max: (center + 10) / 100 }
}
export const showRuneRate = (p: RuneSlot, total: number): p is RuneSlot & { winRate: number } =>
  p.winRate !== null && p.games > 0 && p.games * 100 >= total
const pct = (n: number | null) => (n === null ? '—' : (n * 100).toFixed(1) + '%')
export function runePointLabel(p: RuneSlot, total: number) {
  return (
    message('第{p0}选：{p1}次，胜率 {p2}', {
      p0: p.slot,
      p1: formatCount(p.games),
      p2: pct(p.winRate),
    }) +
    (p.lowSample && p.games ? t('，样本较少') : '') +
    (p.games > 0 && !showRuneRate(p, total) ? t('，选次占比不足 1%，胜率未绘制') : '')
  )
}
export function runePointDescription(p: RuneSlot, total: number) {
  return runePointLabel(p, total)
}
export interface RuneChartTheme {
  count: string
  rate: string
  text: string
  grid: string
  surface: string
  font: string
}
export function runeChartOption(
  points: readonly RuneSlot[],
  baseline: number,
  theme: RuneChartTheme,
  compact = false,
): EChartsOption {
  const total = runeChartTotal(points)
  const highest = Math.max(1, ...points.map(p => p.games))
  const scale = 10 ** Math.max(0, Math.floor(Math.log10(highest / 8)))
  const peak = Math.ceil(highest / 8 / scale) * scale * 8
  const { min, max } = runeRateRange(baseline)
  const inRange = (rate: number) => rate >= min && rate <= max
  const left = compact ? 46 : 58,
    right = compact ? 36 : 48
  return {
    animation: false,
    textStyle: { fontFamily: theme.font, fontSize: 12, color: theme.text },
    grid: { left, right, top: 44, bottom: 32 },
    title: [
      {
        text: t('选择次数'),
        left: 4,
        top: 14,
        padding: 0,
        textStyle: {
          fontFamily: theme.font,
          fontSize: 12,
          fontWeight: 'normal',
          color: theme.count,
        },
      },
      {
        text: t('胜率'),
        right: 4,
        top: 14,
        padding: 0,
        textStyle: {
          fontFamily: theme.font,
          fontSize: 12,
          fontWeight: 'normal',
          color: theme.rate,
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      confine: true,
      backgroundColor: theme.surface,
      borderColor: theme.grid,
      textStyle: { color: theme.text, fontSize: 12 },
      axisPointer: { type: 'line', lineStyle: { color: theme.text, type: 'dashed' } },
      formatter: params => {
        const item = Array.isArray(params) ? params[0] : params
        const point = item && points[item.dataIndex]
        return point
          ? runePointDescription(point, total).replaceAll('，', '\n').replace('；', '\n')
          : ''
      },
    },
    xAxis: {
      type: 'category',
      data: points.map(p => message('第{p0}选', { p0: p.slot })),
      boundaryGap: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: theme.text, interval: 0, fontSize: compact ? 11 : 12 },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: peak,
        interval: peak / 8,
        axisLabel: {
          color: theme.count,
          fontSize: 11,
          align: 'left',
          margin: left - 4,
          formatter: (n: number) => formatCompactCount(n),
        },
        splitLine: { lineStyle: { color: theme.grid } },
      },
      {
        type: 'value',
        position: 'right',
        min,
        max,
        interval: 0.05,
        axisLabel: {
          color: theme.rate,
          fontSize: 11,
          align: 'right',
          margin: right - 4,
          formatter: (n: number) => Math.round(n * 100) + '%',
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        id: 'count',
        name: t('选择次数'),
        type: 'line',
        yAxisIndex: 0,
        data: points.map(p => p.games),
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color: theme.count },
        lineStyle: { color: theme.count, type: 'dashed', width: 2.5 },
      },
      {
        id: 'rate',
        name: t('胜率'),
        type: 'line',
        yAxisIndex: 1,
        connectNulls: false,
        clip: true,
        symbolSize: 8,
        data: points.map(p =>
          showRuneRate(p, total)
            ? {
                value: p.winRate,
                symbol: inRange(p.winRate) ? (p.lowSample ? 'emptyCircle' : 'circle') : 'none',
              }
            : null,
        ),
        itemStyle: { color: theme.rate },
        lineStyle: { color: theme.rate, width: 2.5 },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: theme.text, type: 'dashed', width: 1.5 },
          data: inRange(baseline) ? [{ yAxis: baseline }] : [],
        },
      },
      {
        id: 'overflow',
        name: t('超出胜率范围'),
        type: 'line',
        yAxisIndex: 1,
        lineStyle: { opacity: 0 },
        symbolSize: 10,
        itemStyle: { color: theme.rate },
        tooltip: { show: false },
        data: points.map(p =>
          showRuneRate(p, total) && !inRange(p.winRate)
            ? {
                value: Math.max(min, Math.min(max, p.winRate)),
                symbol: 'triangle',
                symbolRotate: p.winRate > max ? 0 : 180,
              }
            : null,
        ),
      },
    ],
  }
}
