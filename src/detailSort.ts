export type DetailSort='pickRate'|'winRate'|'winRateAsc'|'delta'|'deltaAsc'|'games'
export interface SortableDetailCell {id:string;pickRate:number;winRate:number;games:number;delta?:number}
// Sort the full cohort before batching cards; never mutate cached payloads.
export function sortDetailCells<T extends SortableDetailCell>(cells:readonly T[],sort:DetailSort,lowSampleLast:boolean|number=false,preserveLowSampleOrder=false):T[]{
 const metric=sort==='games'?'games':sort==='pickRate'?'pickRate':sort.startsWith('delta')?'delta':'winRate'
 const minimumGames=typeof lowSampleLast==='number'?lowSampleLast:20
 const direction=sort.endsWith('Asc')?1:-1
 const deferLowSamples=!!lowSampleLast && (metric==='winRate' || metric==='delta')
 return [...cells].sort((a,b)=>preserveLowSampleOrder && deferLowSamples && a.games<minimumGames && b.games<minimumGames?0:(deferLowSamples?Number(a.games<minimumGames)-Number(b.games<minimumGames):0)
  || direction*((a[metric] ?? 0)-(b[metric] ?? 0)) || b.games-a.games || a.id.localeCompare(b.id))
}
