import { init, use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  TitleComponent,
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
use([LineChart, GridComponent, TooltipComponent, MarkLineComponent, TitleComponent, SVGRenderer])
export const createRuneChart = (element: HTMLElement) => init(element, null, { renderer: 'svg' })
