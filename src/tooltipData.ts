import {locale} from './locale'
import {loadGameLocale,gameText,gameName} from './gameLocalization'
export interface DescriptionEntry {name:string;description:string;cooldown?:string;cost?:string;lines?:{text:string;kind:'stat'|'effect'|'text';icon?:string}[];price?:number;rarity?:string;unresolved:boolean}
interface Catalogue {patch:string;queue:number;items:Record<string,DescriptionEntry>;augments:Record<string,DescriptionEntry>}
const cache=new Map<string,Promise<Catalogue>>()
export async function loadTooltipCatalogue(patch:string):Promise<Catalogue>{
 if(!patch.trim())throw new Error('说明版本不匹配')
 if(!cache.has(patch)){
  const promise=fetch('/tooltip-catalogues/'+encodeURIComponent(patch)+'.json?v=item-stats-v3',{signal:AbortSignal.timeout(10000)})
   .then(async response=>{
    if(!response.ok) throw new Error('说明暂不可用')
    const data=await response.json() as Catalogue
    if(data.patch!==patch || data.queue!==2400) throw new Error('说明版本不匹配')
    return data
   }).catch(error=>{cache.delete(patch);throw error})
  cache.set(patch,promise)
 }
 return await cache.get(patch)!
}

export async function loadDescription(patch:string,kind:'items'|'augments'|'spells',id:string):Promise<DescriptionEntry|null>{
 const catalogue=await loadGameLocale(patch)
 if(kind==='spells'){
  const lang=locale.value.replace('-','_'),url=Object.keys(catalogue.sources).find(url=>url.includes('/'+lang+'/summoner.json'))
  if(!url)return null
  if(!spellCache.has(url))spellCache.set(url,fetch('/spell-descriptions/'+encodeURIComponent(patch)+'-'+lang+'.json',{signal:AbortSignal.timeout(10000)}).then(async response=>{if(!response.ok)throw new Error('技能说明暂不可用');return (await response.json()).data}).catch(error=>{spellCache.delete(url);throw error}))
  const entries=await spellCache.get(url)!,spell=Object.values(entries).find(spell=>spell.key===id)
  if(!spell)return null
  return {name:spell.name,description:plainSpellText(spell.description),cooldown:spell.cooldownBurn,cost:plainSpellText(spell.resource || ''),unresolved:false}
 }
 if(kind==='augments')return null
 const value=gameText('items',id,patch)
 return value?.description?{name:gameName('items',id,patch),description:value.description,unresolved:/@[^@]+@/.test(value.description)}:null
}

interface SpellDescription {key:string;name:string;description:string;cooldownBurn:string;resource:string}
const spellCache=new Map<string,Promise<Record<string,SpellDescription>>>()
function plainSpellText(value:string){return value.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ')}
