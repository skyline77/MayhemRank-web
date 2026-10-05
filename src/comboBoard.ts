import {locale} from './locale'
import {loadVersions,selectedPatch} from './versions'
import type {ComboEntry,ComboSort} from './comboRanking'
export interface ComboBoard {
 meta:{queue:number;patch:string;snapshotId:string;scope:string;method:string;confidenceLevel:number|null;runeCount?:number;combinationDefinition?:string;
 region:string;source:string;from:string;cutoff:string;updatedAt:string;minimumGames:number;games:number;
 totalEntries:number;matchedEntries:number;resultLimit:number;returnedEntries:number;sort:ComboSort;query:string}
 entries:ComboEntry[]
}
const requests=new Map<string,Promise<ComboBoard>>()
const resolved=new Map<string,ComboBoard>()
export function cachedComboBoard(generation:string|null,patch:string,runeCount:1|2,sort:ComboSort,query:string){
 return resolved.get(JSON.stringify([generation,patch,runeCount,sort,query,query?locale.value:'']))
}
export async function loadComboBoard(patch?:string,runeCount:1|2=1,sort:ComboSort='winRate',query=''):Promise<ComboBoard>{
 const manifest=await loadVersions()
 patch=patch || selectedPatch.value
 if(!manifest.generation || !manifest.patches.some(p=>p.patch===patch))throw new Error('该版本暂无组合统计')
 const generation=manifest.generation,key=JSON.stringify([generation,patch,runeCount,sort,query,query?locale.value:''])
 if(!requests.has(key)){
  const params=new URLSearchParams({patch,generation,sort,q:query,locale:locale.value})
  if(requests.size>=32){const oldest=requests.keys().next().value!;requests.delete(oldest);resolved.delete(oldest)}
  requests.set(key,fetch((runeCount===2?'/api/double-combo-board?':'/api/combo-board?')+params,{signal:AbortSignal.timeout(20000)}).then(async response=>{
   if(!response.ok)throw new Error('组合统计暂时无法读取')
   const data=await response.json() as ComboBoard
   if(data.meta.queue!==2400 || data.meta.patch!==patch || data.meta.snapshotId!==generation
    || data.meta.scope!=='all-valid-appearances' || ![null,.9].includes(data.meta.confidenceLevel)
    || !Array.isArray(data.entries) || data.entries.length>100 || data.meta.resultLimit!==100
    || data.meta.returnedEntries!==data.entries.length || data.meta.sort!==sort || data.meta.query!==query
    || !Number.isInteger(data.meta.matchedEntries) || data.meta.matchedEntries<data.entries.length
    || !Number.isInteger(data.meta.totalEntries) || data.meta.totalEntries<data.meta.matchedEntries)throw new Error('组合统计版本不一致')
   if(runeCount===2 && (data.meta.runeCount!==2 || data.meta.method!=='beta50-fixed-hero-baseline-v1'
    || data.meta.combinationDefinition!=='same-hero-same-appearance-unordered-distinct-runes'
    || data.entries.some(row=>!row.secondRuneId || row.secondRuneId===row.runeId || !row.secondRuneName || !row.secondRuneIcon)))throw new Error('双符文组合统计不完整')
   if(requests.has(key))resolved.set(key,data)
   return data
  }).catch(error=>{requests.delete(key);throw error}))
 }
 return requests.get(key)!
}
