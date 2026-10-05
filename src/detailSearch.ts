import {gameAliases} from './gameLocalization'
import {localizedChampionSearchFields} from './championSearch'
import { matchesSearch } from './search'
import type { DetailCell } from './buildDetails'
export interface DetailSearchIndex {patch:string;queue:number;items:Record<string,string[]>;augments:Record<string,string[]>;augmentInitials?:Record<string,string[]>;itemInitials?:Record<string,string[]>}
const cache=new Map<string,Promise<DetailSearchIndex>>()
export async function loadDetailSearch(patch:string):Promise<DetailSearchIndex> {
 if(!cache.has(patch)) cache.set(patch,fetch('/search-catalogues/'+encodeURIComponent(patch)+'.json?v=4',{signal:AbortSignal.timeout(10000)})
  .then(async response=>{
   if(!response.ok)throw new Error('搜索词暂时无法读取')
   const index=await response.json() as DetailSearchIndex
   if(index.patch!==patch || index.queue!==2400)throw new Error('搜索词版本与详情不一致')
   return index
  }).catch(error=>{cache.delete(patch);throw error}))
 return cache.get(patch)!
}
// The suggestion list and in-place detail filter use the same names, pinyin and initials.
export function catalogueSearchFields(kind:'items'|'augments',cell:{id:string;name:string},index:DetailSearchIndex|null):readonly (readonly [string,number])[] {
 return [[cell.name,0],...gameAliases(kind,cell.id,index?.patch).map(value=>[value,0] as const),...(index?.[kind]?.[cell.id] || []).map(alias=>[alias,1] as const),
  ...(index?.[kind==='items'?'itemInitials':'augmentInitials']?.[cell.id] || []).map(alias=>[alias,2] as const)]
}
export function filterDetailGroups(groups:Record<string,DetailCell[]>,query:string,index:DetailSearchIndex|null) {
 return Object.fromEntries(Object.entries(groups).map(([group,cells])=>[group,cells.filter(cell=>matchesDetailSearch(group,cell,query,index))]))
}
export function matchesDetailSearch(group:string,cell:DetailCell,query:string,index:DetailSearchIndex|null):boolean {
 return matchesSearch([
  ...catalogueSearchFields(group==='items' || group==='boots'?'items':'augments',cell,index).map(([value])=>value),
  ...(cell.noBoots?['wuxie','wx','guangjiao','gj','光脚','终局未持有鞋子']:[])
 ],query)
}

// All three rune-detail rails use the same normalized partial-name/alias matching.
export function matchesRuneDetailSearch(kind:'heroes'|'augments'|'items',cell:{id:string;name:string},query:string,index:DetailSearchIndex|null):boolean {
 const fields=kind==='heroes'
  ?[cell.name,...gameAliases('champions',cell.id,index?.patch),...localizedChampionSearchFields(cell.id).map(([value])=>value)]
  :catalogueSearchFields(kind,cell,index).map(([value])=>value)
 return matchesSearch(fields,query)
}
