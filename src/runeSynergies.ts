export const RUNE_SYNERGY_MIN_GAMES=50
export type SynergyKind='augments'|'items'
export interface RuneSynergy {
 id:string;name:string;icon:string;rarity?:string;games:number;wins:number;rawWinRate:number;
 winRate:number;baselineWinRate:number;delta:number;interval:number[];lowSample:boolean;heroCount:number;heroIds?:string[];pickRate:number
}
export interface RuneSynergies {
 meta:{queue:number;patch:string;snapshotId:string;scope:string;itemScope:string;method:string;synergyMethod:string;
  weighting:string;baselineIncludesCombination:boolean;confidenceLevel:number|null;intervalMethod:string;
  region:string;source:string;from:string;cutoff:string;updatedAt:string}
 runeId:string;augments:{games:number;entries:RuneSynergy[]};items:{games:number;entries:RuneSynergy[]}
}
const requests=new Map<string,Promise<RuneSynergies>>()
const probability=(n:number)=>Number.isFinite(n) && n>=0 && n<=1
export async function loadRuneSynergies(runeId:string,patch:string,generation?:string):Promise<RuneSynergies>{
 if(!generation)throw new Error('当前快照尚未提供联动统计，请更新数据后重试')
 if(!/^\d+$/.test(runeId) || !/^\d+\.\d+$/.test(patch) || !/^[\w-]+$/.test(generation))throw new Error('无效的统计范围')
 const path=`/snapshots/${generation}/${patch}/rune-synergies/${runeId}.json`
 if(!requests.has(path))requests.set(path,fetch(path,{signal:AbortSignal.timeout(15000)}).then(async response=>{
  if(!response.ok)throw new Error(response.status===404?'当前快照尚无该符文的联动统计':'联动统计暂时无法读取')
  const data=await response.json() as RuneSynergies
  if(data.meta?.queue!==2400 || data.meta.patch!==patch || data.meta.snapshotId!==generation || data.runeId!==runeId
   || data.meta.method!=='beta50-fixed-hero-baseline-v1' || data.meta.synergyMethod!=='hero-standardized-rune-cooccurrence-v1'
   || data.meta.scope!=='all-valid-appearances' || data.meta.itemScope!=='inventory-complete-appearances'
   || data.meta.weighting!=='combination-hero-appearances' || data.meta.baselineIncludesCombination!==true
   || ![null,.90].includes(data.meta.confidenceLevel) || !['not-computed','moment-matched-weighted-beta-90'].includes(data.meta.intervalMethod))throw new Error('联动统计与当前符文或版本不一致')
  for(const kind of ['augments','items'] as const){
   const group=data[kind]
   if(!group || !Number.isInteger(group.games) || group.games<0 || !Array.isArray(group.entries))throw new Error('联动统计不完整')
   const ids=new Set<string>()
   for(const e of group.entries){
    if(!/^\d+$/.test(e.id) || ids.has(e.id) || (kind==='augments' && (e.id===runeId || !['kPrismatic','kGold','kSilver'].includes(e.rarity || '')))
     || !Number.isInteger(e.games) || e.games<=0 || e.games>group.games || !Number.isInteger(e.wins) || e.wins<0 || e.wins>e.games
     || !Number.isInteger(e.heroCount) || e.heroCount<=0 || e.heroCount>e.games
     || !probability(e.winRate) || !probability(e.baselineWinRate) || !Number.isFinite(e.delta)
     || Math.abs(e.winRate-e.baselineWinRate-e.delta)>1e-10
     || !probability(e.rawWinRate) || Math.abs(e.rawWinRate-e.wins/e.games)>1e-10
     || !probability(e.pickRate) || Math.abs(e.pickRate-e.games/group.games)>1e-10
     || !Array.isArray(e.interval) || e.interval.length!==(data.meta.intervalMethod==='not-computed'?0:2) || !e.interval.every(probability) || e.interval[0]!>e.interval[1]!)throw new Error('联动统计不完整')
    ids.add(e.id)
   }
  }
  return data
 }).catch(error=>{requests.delete(path);throw error}))
 return requests.get(path)!
}
