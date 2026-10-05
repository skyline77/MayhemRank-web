import {locale} from './locale'
import {ref,watch} from 'vue'
import {loadPatchNotes,recentPatches,type PatchKind} from './patchNotes'

export function usePatchAvailability(kind:PatchKind,entityId:()=>string|number,patch:()=>string){
 const available=ref<boolean|null>(null)
 watch(()=>[entityId(),patch(),locale.value] as const,async([id,version],_,onCleanup)=>{
  let stale=false;onCleanup(()=>{stale=true})
  available.value=null
  try{
   const data=await loadPatchNotes()
   if(!stale)available.value=recentPatches(data,kind,id,version).length>0
  }catch{/* Unknown is not empty: allow opening the panel to retry a failed request. */}
 },{immediate:true})
 return available
}
