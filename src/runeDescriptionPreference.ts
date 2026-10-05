export type DescriptionMode='simple'|'wiki'|'translation'
export type DescriptionSide='left'|'right'
const cookieName=(side:DescriptionSide)=>'team-rune-description-'+side
const validMode=(value:string):value is DescriptionMode=>['simple','wiki','translation'].includes(value)
export function readDescriptionPreference(side:DescriptionSide,fallback:DescriptionMode):DescriptionMode{
 try{
  const prefix=cookieName(side)+'='
  const value=document.cookie.split(';').map(part=>part.trim()).find(part=>part.startsWith(prefix))?.slice(prefix.length)
  return value && validMode(value)?value:fallback
 }catch{return fallback}
}
export function saveDescriptionPreference(side:DescriptionSide,mode:DescriptionMode){
 try{
  // First-party presentation preference only; no identifier or tracking data.
  document.cookie=cookieName(side)+'='+mode+'; Path=/; Max-Age=15552000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'')
 }catch{/* Blocked cookies must not prevent changing the visible panel. */}
}
