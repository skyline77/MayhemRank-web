<script setup lang="ts">
import {isInlineActivation} from './detailLink'
defineProps<{href:string}>()
const emit=defineEmits<{activate:[event:MouseEvent,trigger:HTMLAnchorElement]}>()
function activate(event:MouseEvent){
 if(event.defaultPrevented || !isInlineActivation(event))return
 event.preventDefault()
 emit('activate',event,event.currentTarget as HTMLAnchorElement)
}
</script>
<template><a :href="href" draggable="true" @click="activate"><slot /></a></template>
