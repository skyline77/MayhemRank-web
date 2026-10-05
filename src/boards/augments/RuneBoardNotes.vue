<!-- 海克斯榜底部：统计口径说明、样本不足的符文与数据来源页脚。 -->
<script setup lang="ts">
import { t, message } from '@/i18n/i18n'
import { gameName } from '@/i18n/gameLocalization'
import { formatCount } from '@/stats/formatCount'
import type { RuneBoard, RuneEntry } from './augmentBoard'

defineProps<{ meta: RuneBoard['meta']; unranked: RuneEntry[] }>()
const count = formatCount
</script>

<template>
  <details class="board-method">
    <summary>{{ t('数据范围与胜率说明') }}</summary>
    <p>
      Mayhem · queue {{ meta.queue }} · {{ meta.patch }} · {{ t(meta.region) }}。{{
        meta.source
      }}；{{ meta.from.slice(0, 10) }}{{ t('至') }}{{ meta.cutoff.slice(0, 10)
      }}{{ t('（UTC），来源共') }}{{ count(meta.games) }}{{ t('场对局。') }}
    </p>
    <p>
      {{ t('首版复用英雄流派快照，仅涵盖可分类且具有已知符文记录的') }}{{ count(meta.denominator)
      }}{{
        t(
          '个出场人次，不代表全部对局。缺失装备、不足两件 TOP10 成装、无法识别流派或没有已知符文的出场不进入分母。',
        )
      }}
    </p>
    <p>
      {{
        t(
          '胜率按原始胜场、使用人次合并后计算（胜场 + 1）÷（使用人次 + 2），不平均各英雄或流派的胜率。使用率 = 携带该符文的人次 ÷ 上述有效出场人次，不是出现后的选择率；每人可携带多个符文，总和可超过 100%。',
        )
      }}
    </p>
    <p>
      {{ t('复用英雄榜每 2 个百分点的分档，至少') }}{{ meta.minimumGames
      }}{{
        t(
          '人次才入榜。同格按未取整平滑胜率和样本数降序。胜率是历史关联，受英雄和流派构成影响，不表示因果收益。',
        )
      }}
    </p>
  </details>
  <details v-if="unranked.length" class="board-method">
    <summary>{{ unranked.length }}{{ t('个符文样本不足，暂不分档') }}</summary>
    <p>
      <span v-for="entry in unranked" :key="entry.id"
        >{{ gameName('augments', entry.id, meta.patch, entry.name) }}（{{ count(entry.games)
        }}{{ t('人次）') }}</span
      >
    </p>
  </details>
  <footer class="board-footer">
    <span>{{
      message('数据地区：{region} · 版本 {patch} · 队列 {queue}', {
        region: t(meta.region) || t('地区无法核验'),
        patch: meta.patch,
        queue: meta.queue,
      })
    }}</span
    ><span>Mayhem · 2400 · {{ meta.patch }}</span
    ><span>{{ count(meta.denominator) }}{{ t('个有效出场人次 ·') }}{{ t(meta.region) }}</span
    ><span>{{ t('按胜率分档 · 棱彩 / 黄金 / 白银') }}</span>
  </footer>
</template>
