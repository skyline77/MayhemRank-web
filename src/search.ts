// Bound retained strings; keys are text values, so changed labels cannot reuse stale results.
const normalizedText=new Map<string,string>()
export function normalizeSearch(value:string):string {
 const cached=normalizedText.get(value)
 if(cached!==undefined)return cached
 const result=value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}]/gu,'')
 if(normalizedText.size>=4096)normalizedText.delete(normalizedText.keys().next().value!)
 normalizedText.set(value,result)
 return result
}
export function matchesSearch(values:readonly string[],query:string):boolean {
 const term=normalizeSearch(query)
 return !term || values.some(value=>normalizeSearch(value).includes(term))
}

export function singleSearchCandidate<T>(candidates:readonly T[],query:string):T|null {
 return normalizeSearch(query) && candidates.length===1?candidates[0]!:null
}
export function isSearchSubmit(event:KeyboardEvent):boolean {
 return event.key==='Enter' && !event.defaultPrevented && !event.isComposing && event.keyCode!==229
  && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
}
