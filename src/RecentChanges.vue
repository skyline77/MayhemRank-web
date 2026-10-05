<script setup lang="ts">
import {t,message} from './i18n'
import DetailSection from './DetailSection.vue'
import DetailPatchNotes from './DetailPatchNotes.vue'
import type {PatchKind} from './patchNotes'
defineProps<{id:string;kind:PatchKind;entityId:string|number;patch:string;modelValue:boolean;available:boolean|null;hideSourceNote?:boolean}>()
defineEmits<{'update:modelValue':[value:boolean]}>()
</script>
<template>
 <DetailSection data-detail-patches :id="id" :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)" :title="available === false ? t('近期改动：无') : t('近期改动')" :disabled="available===false">
  <template #heading-note><slot name="heading-note" /></template>
  <DetailPatchNotes :id="id+'-notes'" :heading-id="id+'-title'" hide-heading :hide-source-note="hideSourceNote" :kind="kind" :entity-id="entityId" :patch="patch" />
 </DetailSection>
</template>

<style scoped>
@media(min-width:701px){
 [data-detail-patches]{margin-left:calc(var(--detail-rail-width) + 8px);margin-right:calc(var(--detail-rail-width) + 108px)}
}
</style>
