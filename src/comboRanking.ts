import {normalizeSearch} from './search'
import championTitles from './championTitles'
export interface ComboEntry {
 championId:string;championName:string;championIcon:string;runeId:string;runeName:string;runeIcon:string
 secondRuneId?:string;secondRuneName?:string;secondRuneIcon?:string;runeRarity?:string;secondRuneRarity?:string
 games:number;wins:number;winRate:number;interval:number[];baseline:number;delta:number
}
export type ComboSort='winRate'|'delta'
const rarityOrder:Record<string,number>={kPrismatic:0,kGold:1,kSilver:2}
// Apply only after ranking: display order must not change a combination's identity or tie-breaks.
export function orderComboRunes(row:ComboEntry,rarities:Readonly<Record<string,string>>):ComboEntry {
 if(!row.secondRuneId || !row.secondRuneName || !row.secondRuneIcon)return row
 const first=rarityOrder[rarities[row.runeId] ?? ''],second=rarityOrder[rarities[row.secondRuneId] ?? '']
 if(first===undefined || second===undefined || first<=second)return row
 return {...row,runeId:row.secondRuneId,runeName:row.secondRuneName,runeIcon:row.secondRuneIcon,
  secondRuneId:row.runeId,secondRuneName:row.runeName,secondRuneIcon:row.runeIcon}
}
export function rankCombos(entries:readonly ComboEntry[],query:string,minimum:number,sort:ComboSort){
 const terms=query.trim().split(/[\s+＋]+/u).map(normalizeSearch).filter(Boolean)
 return entries.filter(row=>row.games>=minimum && terms.every(term=>normalizeSearch(row.championName+(championTitles[row.championId] || '')+row.runeName+(row.secondRuneName || '')).includes(term)))
  .sort((a,b)=>b[sort]-a[sort] || b.games-a.games || a.championId.localeCompare(b.championId) || a.runeId.localeCompare(b.runeId) || (a.secondRuneId || '').localeCompare(b.secondRuneId || ''))
}
