import {computed,shallowRef,watch} from 'vue'
import {reconcileLockedOrder} from './lockedOrder'
export function useLockedOrder<T extends {id:string}>(cells:()=>readonly T[],locked:()=>boolean,missing:(cell:T)=>T,available:()=>readonly T[]=cells){
 const frozen=shallowRef<readonly T[]>([])
 watch([locked,cells,available],([isLocked,current,all])=>{
  frozen.value=isLocked?reconcileLockedOrder(frozen.value,current,missing,all):[]
 },{immediate:true,flush:'sync'})
 return computed(()=>locked()?frozen.value:cells())
}
