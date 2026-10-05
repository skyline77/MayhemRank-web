import { t } from './i18n'
import { init, use } from 'echarts/core'
import { CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, DataZoomComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { EChartsOption, CustomSeriesRenderItem } from 'echarts'
import { heroChartBounds, heroArrowDescription, type ChartHero } from './runeHeroChart'
use([CustomChart, GridComponent, TooltipComponent, DataZoomComponent, SVGRenderer])
export const createHeroChart = (host: HTMLElement) => init(host, null, { renderer: 'svg' })
export interface HeroChartTheme {
  text: string
  grid: string
  surface: string
  accent: string
  colors: string[]
  font: string
  width: number
}
export type HeroChartZoom = { x: [number, number]; y: [number, number] }
export function heroChartOption(
  entries: ChartHero[],
  selected: string,
  theme: HeroChartTheme,
  zoom: HeroChartZoom,
): EChartsOption {
  const bounds = heroChartBounds(entries)
  const renderItem: CustomSeriesRenderItem = (params, api) => {
    const hero = entries[params.dataIndex]!
    const start = api.coord([hero.sameRarityPickRate, hero.baseline.winRate])
    const end = api.coord([hero.sameRarityPickRate, hero.winRate])
    const cs = params.coordSys as unknown as { x: number; y: number; width: number; height: number }
    const color = theme.colors[params.dataIndex]!,
      chosen = selected === hero.id
    const direction = end[1]! < start[1]! ? -1 : 1
    const hasArrow = Math.abs(end[1]! - start[1]!) > 1
    const visible =
      end[0]! >= cs.x &&
      end[0]! <= cs.x + cs.width &&
      end[1]! >= cs.y &&
      end[1]! <= cs.y + cs.height
    return {
      type: 'group',
      children: [
        {
          type: 'line',
          shape: { x1: start[0]!, y1: start[1]!, x2: end[0]!, y2: end[1]! },
          style: { stroke: color, lineWidth: chosen ? 2.5 : 1.5 },
          z2: chosen ? 20 : 1,
        },
        {
          type: 'circle',
          shape: { cx: start[0]!, cy: start[1]!, r: 2.5 },
          style: { fill: theme.surface, stroke: color, lineWidth: 1.5 },
          z2: chosen ? 21 : 2,
        },
        ...(visible
          ? [
              {
                type: 'image' as const,
                style: {
                  image: hero.icon,
                  x: end[0]! - 15,
                  y: end[1]! - 15,
                  width: 30,
                  height: 30,
                },
                z2: chosen ? 22 : 3,
              },
              {
                type: 'rect' as const,
                shape: { x: end[0]! - 16, y: end[1]! - 16, width: 32, height: 32 },
                style: {
                  fill: 'transparent',
                  stroke: chosen ? theme.accent : color,
                  lineWidth: chosen ? 2.5 : 1,
                },
                z2: chosen ? 23 : 4,
              },
              ...(hasArrow
                ? [
                    {
                      type: 'polygon' as const,
                      shape: {
                        points: [
                          [end[0]!, end[1]!],
                          [end[0]! - 4, end[1]! - direction * 7],
                          [end[0]! + 4, end[1]! - direction * 7],
                        ],
                      },
                      style: { fill: color, stroke: theme.surface, lineWidth: 0.5 },
                      z2: chosen ? 24 : 5,
                    },
                  ]
                : []),
            ]
          : []),
      ],
    }
  }
  return {
    animation: false,
    textStyle: { fontFamily: theme.font, color: theme.text },
    grid: { left: 46, right: 40, top: 36, bottom: 86 },
    tooltip: {
      trigger: 'item',
      renderMode: 'richText',
      confine: true,
      backgroundColor: theme.surface,
      borderColor: theme.grid,
      textStyle: { color: theme.text, fontSize: 12 },
      formatter: p => {
        const item = Array.isArray(p) ? p[0] : p,
          hero = item && entries[item.dataIndex]
        if (!hero) return ''
        const chars = Math.max(16, Math.min(44, Math.floor((theme.width - 32) / 12)))
        return heroArrowDescription(hero)
          .split(/[。；]/)
          .flatMap(line => line.match(new RegExp('.{1,' + chars + '}', 'gu')) || [])
          .join('\n')
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: bounds.xMax,
      name: t('同品质符文选用率'),
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: { formatter: (n: number) => +(n * 100).toFixed(1) + '%', color: theme.text },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    yAxis: {
      type: 'value',
      min: bounds.yMin,
      max: bounds.yMax,
      name: t('胜率'),
      axisLabel: { formatter: (n: number) => Math.round(n * 100) + '%', color: theme.text },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    dataZoom: [
      {
        id: 'hero-x',
        type: 'slider',
        xAxisIndex: 0,
        start: zoom.x[0],
        end: zoom.x[1],
        bottom: 8,
        height: 22,
        filterMode: 'none',
        showDetail: false,
        brushSelect: false,
      },
      {
        id: 'hero-y',
        type: 'slider',
        yAxisIndex: 0,
        start: zoom.y[0],
        end: zoom.y[1],
        right: 0,
        width: 14,
        filterMode: 'none',
        showDetail: false,
        brushSelect: false,
      },
    ],
    series: [
      {
        type: 'custom',
        id: 'hero-arrows',
        clip: true,
        renderItem,
        encode: { x: 0, y: [1, 2] },
        data: entries.map(e => ({
          name: e.name,
          value: [e.sameRarityPickRate, e.baseline.winRate, e.winRate],
        })),
      },
    ],
  }
}
