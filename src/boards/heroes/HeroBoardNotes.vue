<!-- 英雄榜底部：统计口径说明、样本不足的流派与数据来源页脚。 -->
<script setup lang="ts">
import { t, message } from '@/i18n/i18n'
import { gameName, roleName } from '@/i18n/gameLocalization'
import { formatCount } from '@/stats/formatCount'
import type { BoardMeta, BuildEntry } from './buildBoard'

defineProps<{ meta: BoardMeta; rankingMode: string; unranked: BuildEntry[] }>()
const count = formatCount
const day = (v: string) => v.slice(0, 10)
</script>

<template>
  <details class="board-method">
    <summary>{{ t('数据范围与胜率说明') }}</summary>
    <p>
      Mayhem · queue {{ meta.queue }} · {{ meta.patch }} · {{ t(meta.region) }}。{{ meta.source
      }}{{ t('，共') }}{{ count(meta.games) }}{{ t('场对局、') }}{{ count(meta.appearances)
      }}{{ t('个可分类英雄样本；') }}{{ day(meta.from) }}{{ t('至')
      }}{{ day(meta.cutoff) }}（UTC）。
    </p>
    <p v-if="rankingMode === 'heroes'">
      {{
        t(
          '每个英雄只显示一次，按全部有效出场的整体胜率分档，包含未能分类的出场。职责列按该英雄出场最多的职责决定（同列流派合并场次），仅决定展示位置，不筛选统计样本。胜率与英雄详情的“全部出场”一致，沿用固定英雄基准的 Beta(50) 平滑。至少',
        )
      }}{{ meta.minimumGames }}{{ t('场才进入分档。') }}
    </p>
    <p v-else>
      {{
        t(
          '每张头像代表一个英雄的具体流派。职责列仅合并展示位置，保留原有流派的胜场和样本；例如近战暴击属于 AD 输出。流派按终局装备与既有分类划分，描述历史关联，不能解释为选择该出装带来的因果收益。',
        )
      }}
    </p>
    <p v-if="rankingMode === 'roles'">
      {{ t('流派胜率采用中性 Beta(1,1) 平滑，并列归类按归属权重计算有效样本量。至少')
      }}{{ meta.minimumGames
      }}{{
        t(
          '场才进入胜率分档；分档使用未四舍五入的值，下界包含、上界不包含。同格按平滑胜率降序，持平时参考样本数。',
        )
      }}
    </p>
    <p v-if="meta.classification">
      {{ meta.classification }}{{ t('。无法归类的出场（含旧口径特征不足）')
      }}{{
        count(
          (meta.exclusions.unclassified_inventory || 0) +
            (meta.exclusions.fewer_than_two_top10_completed_items || 0),
        )
      }}{{ t('人次，未知英雄') }}{{ count(meta.exclusions.unknown_champion || 0)
      }}{{ t('人次，不归入具体流派，达到2件成装门槛的未分类出场仍计入流派使用率的分母。') }}
    </p>
    <p>
      {{
        t(
          '两种口径均按使用率从高到低保留流派，直到未展示流派合计不超过流派统计分母的 5%；未分类单独统计。流派统计要求终局至少2件成装；流派出场率 = 该流派场次 ÷ 同版本该英雄至少2件成装的出场次数，各流派比例之和可能小于 100%。隐藏流派保留原始统计，不重新分配比例，也不计入未分类。不足2件成装的',
        )
      }}{{ count(meta.exclusions.fewer_than_two_completed_items || 0)
      }}{{ t('人次单列为出装未成型；缺失装备的') }}{{ count(meta.exclusions.missing_inventory || 0)
      }}{{ t('人次也不进入流派分母。英雄整体统计仍保留全部有效出场。') }}
    </p>
    <p>
      {{ t('当前队伍只用于显示客户端阵容；队伍头像与榜单头像使用相同版本、相同流派的历史统计。') }}
    </p>
  </details>
  <p v-if="unranked.length" class="board-footnote">
    {{ t('样本不足，暂不分档：')
    }}<span v-for="entry in unranked" :key="entry.id"
      >{{ gameName('champions', entry.championId, meta.patch, entry.name) }} ·
      {{ roleName(entry, meta.patch) }}（{{ formatCount(entry.games) }}{{ t('场）') }}</span
    >
  </p>
  <footer class="board-footer">
    <span>{{
      message('数据地区：{region} · 版本 {patch} · 队列 {queue}', {
        region: t(meta.region) || t('地区无法核验'),
        patch: meta.patch,
        queue: meta.queue,
      })
    }}</span
    ><span>Mayhem · 2400 · {{ meta.patch }} · {{ count(meta.games) }}{{ t('场') }}</span
    ><span>{{ day(meta.from) }} — {{ day(meta.cutoff) }}{{ t('UTC · 地区无法核验') }}</span
    ><span>{{
      rankingMode === 'heroes' ? t('点击头像查看英雄全部出场详情') : t('点击头像查看该流派详情')
    }}</span>
  </footer>
</template>
