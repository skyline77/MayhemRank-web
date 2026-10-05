export interface RuneDescription {name:string;description:string;anchor:string;sourceDescription?:string}
export type WikiLocale='en_US'|'zh_CN'
export interface RuneDescriptionCatalogue {
 schema:number;queue:number;scope:string;locale:string
 source:{url:string;title:string;authors:string;history:string;license:string;licenseUrl:string;capturedAt:string}
 entries:Record<string,RuneDescription>
}
const requests=new Map<WikiLocale,Promise<RuneDescriptionCatalogue>>()
export function loadRuneDescriptions(locale:WikiLocale='en_US'):Promise<RuneDescriptionCatalogue>{
 const cached=requests.get(locale)
 if(cached)return cached
 const name=locale==='en_US'?'英文说明':'Wiki 中文译文'
 const file=locale==='en_US'?'wiki-en-20260925.json':'wiki-zh-CN-20260925.json'
 const request=fetch('/rune-descriptions/'+file,{signal:AbortSignal.timeout(10000)})
  .then(async response=>{
   if(!response.ok)throw new Error(name+'暂时无法读取')
   const data=await response.json() as RuneDescriptionCatalogue
   if(data.schema!==1 || data.queue!==2400 || data.locale!==locale || data.scope!=='wiki-current' || !data.entries)throw new Error(name+'格式不匹配')
   return data
  }).catch(error=>{requests.delete(locale);throw error})
 requests.set(locale,request)
 return request
}
// Never pair a translated old excerpt with a revised English effect.
export function matchingRuneTranslation(wiki?:RuneDescription,translation?:RuneDescription):RuneDescription|undefined{
 return wiki && translation?.sourceDescription===wiki.description && translation.description.trim()?translation:undefined
}
