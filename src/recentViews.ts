import {ref} from 'vue'
type Scope='hero'|'rune'
const key=(scope:Scope)=>'team-site.recent-views.'+scope
function read(scope:Scope):string[]{
 try{const value=JSON.parse(localStorage.getItem(key(scope)) || '[]');return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'))].slice(0,5):[]}catch{return []}
}
export const recentViews={hero:ref(read('hero')),rune:ref(read('rune'))}
export function rememberView(scope:Scope,id:string){
 const ids=[id,...recentViews[scope].value.filter(value=>value!==id)].slice(0,5)
 recentViews[scope].value=ids
 try{localStorage.setItem(key(scope),JSON.stringify(ids))}catch{/* Browsing remains available without storage. */}
}
