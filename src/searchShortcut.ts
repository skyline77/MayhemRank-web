type Viewport={innerHeight:number;innerWidth:number}

export function findSiteSearch(root:Document=document,viewport:Viewport=window):HTMLInputElement|null{
 const inputs=Array.from(root.querySelectorAll<HTMLInputElement>('input[data-site-search]'))
  .filter(input=>!input.disabled && input.getClientRects().length>0)
 const details=inputs.filter(input=>input.dataset.siteSearch==='detail' || !!input.closest('.build-detail'))
 const visible=details.map(input=>{
  const panel=input.closest<HTMLElement>('.build-detail')
  const box=panel?.getBoundingClientRect()
  const height=box?Math.max(0,Math.min(box.bottom,viewport.innerHeight)-Math.max(box.top,0)):0
  const width=box?Math.max(0,Math.min(box.right,viewport.innerWidth)-Math.max(box.left,0)):0
  return {input,area:height*width,focused:!!panel?.contains(root.activeElement)}
 }).filter(candidate=>candidate.area>0)
 // During a row handoff, prefer the visible panel being used, then the one
 // occupying most of the viewport, rather than the first mounted detail.
 visible.sort((a,b)=>Number(b.input===root.activeElement)-Number(a.input===root.activeElement)
  || Number(b.focused)-Number(a.focused) || b.area-a.area
  || Number(b.input.dataset.siteSearch==='detail')-Number(a.input.dataset.siteSearch==='detail'))
 return visible[0]?.input || inputs.find(input=>input.dataset.siteSearch==='hero' || input.dataset.siteSearch==='rune') || details[0] || null
}

function detailSearchFields(input:HTMLInputElement,root:Document):HTMLInputElement[]{
 // Explicit groups connect teleported navigation searches to their board detail.
 const group=input.closest('[data-search-group]')?.getAttribute?.('data-search-group')
 if(group)return Array.from(root.querySelectorAll<HTMLInputElement>('input[data-site-search]'))
  .filter(field=>!field.disabled && field.getClientRects().length>0
   && field.closest('[data-search-group]')?.getAttribute?.('data-search-group')===group)
 const panel=input.closest('.build-detail')
 return panel?Array.from(root.querySelectorAll<HTMLInputElement>('input[data-site-search]'))
  .filter(field=>!field.disabled && field.getClientRects().length>0 && field.closest('.build-detail')===panel):[]
}
type SearchSession={usedFind:boolean;last:HTMLInputElement|null}
// DOM panel identity starts a fresh session whenever a detail is closed/reopened.
const searchSessions=new WeakMap<Element,SearchSession>()
function searchSession(input:HTMLInputElement,peers:HTMLInputElement[]):SearchSession|undefined{
 const panel=input.closest('.build-detail') || peers.find(field=>field.dataset.siteSearch==='detail')?.closest('.build-detail')
 if(!panel)return
 let session=searchSessions.get(panel)
 if(!session){session={usedFind:false,last:null};searchSessions.set(panel,session)}
 return session
}
export function rememberSearchFocus(input:HTMLInputElement,root:Document=document){
 const session=searchSession(input,detailSearchFields(input,root))
 if(session)session.last=input
}
function focusSearch(input:HTMLInputElement){
 input.focus({preventScroll:true})
 input.select()
 input.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})
}
export function handleSearchArrow(event:KeyboardEvent,root:Document=document):boolean{
 if(event.defaultPrevented || event.isComposing || event.keyCode===229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !['ArrowUp','ArrowDown'].includes(event.key))return false
 const input=event.currentTarget as HTMLInputElement|null
 if(!input || input.value)return false
 const peers=detailSearchFields(input,root),current=peers.indexOf(input)
 if(current<0 || peers.length<2 || peers.some(field=>field.value))return false
 event.preventDefault();event.stopPropagation()
 if(!event.repeat)focusSearch(peers[(current+(event.key==='ArrowDown'?1:-1)+peers.length)%peers.length]!)
 return true
}

// Preview and execution share one target resolver; preview never consumes a Ctrl+F press.
export function nextFindTarget(root:Document=document,viewport:Viewport=window){
 let input=findSiteSearch(root,viewport)
 if(!input)return null
 const peers=detailSearchFields(input,root)
 const current=peers.findIndex(field=>field===root.activeElement)
 const session=searchSession(input,peers)
 if(current>=0 && peers.length>1)input=peers[(current+1)%peers.length]!
 else if(current<0 && session){
  input=session.usedFind && session.last && peers.includes(session.last)
   ?session.last:peers.find(field=>field.dataset.siteSearch==='detail') || input
 }
 return {input,session,switching:current>=0 && peers.length>1}
}

export function handleFindShortcut(event:KeyboardEvent,beforeFocus=()=>{},root:Document=document,viewport:Viewport=window){
 if(event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase()!=='f')return
 const target=nextFindTarget(root,viewport)
 if(!target)return // Keep browser find available when the site has no search yet.
 event.preventDefault()
 if(event.repeat)return // One switch per press, even when the shortcut is held.
 const {input,session}=target
 if(session){session.usedFind=true;session.last=input}
 beforeFocus()
 focusSearch(input)
}


export function handleDetailEscape(event:KeyboardEvent,beforeClose=()=>{},root:Document=document,viewport:Viewport=window){
 if(event.key!=='Escape' || event.defaultPrevented || event.isComposing || event.repeat)return
 // SearchBox owns Escape, including when its value is already empty.
 if(root.activeElement?.matches('input[data-site-search]'))return
 const focusedPanel=root.activeElement?.closest('.build-detail')
 // Keep the same viewport fallback for detail surfaces without a search field.
 const viewedPanel=findSiteSearch(root,viewport)?.closest('.build-detail')
  || Array.from(root.querySelectorAll<HTMLElement>('.rune-detail')).map(panel=>{
   const box=panel.getBoundingClientRect()
   const area=Math.max(0,Math.min(box.bottom,viewport.innerHeight)-Math.max(box.top,0))
    *Math.max(0,Math.min(box.right,viewport.innerWidth)-Math.max(box.left,0))
   return {panel,area}
  }).filter(candidate=>candidate.area>0).sort((a,b)=>b.area-a.area)[0]?.panel
 const recentChanges=(focusedPanel || viewedPanel)?.querySelector<HTMLButtonElement>('[data-detail-patches] .detail-section-toggle[aria-expanded="true"]')
 if(recentChanges && !recentChanges.disabled && recentChanges.getClientRects().length>0){
  event.preventDefault()
  event.stopPropagation()
  beforeClose()
  recentChanges.click()
  return
 }
 const buttons=Array.from(root.querySelectorAll<HTMLButtonElement>('button.build-detail-close'))
  .filter(button=>!button.disabled && button.getClientRects().length>0)
 if(!buttons.length)return
 const focused=focusedPanel?.querySelector<HTMLButtonElement>('button.build-detail-close')
 const viewed=viewedPanel?.querySelector<HTMLButtonElement>('button.build-detail-close')
 const button=(focused && buttons.includes(focused)?focused:null)
  || (viewed && buttons.includes(viewed)?viewed:null) || buttons[buttons.length-1]!
 event.preventDefault()
 event.stopPropagation()
 beforeClose()
 button.click()
}
