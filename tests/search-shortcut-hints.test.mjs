import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {locale}=await loadTS('../src/locale.ts');locale.value='zh-CN'
const {updateSearchShortcutHints}=await loadTS('../src/searchShortcutHints.ts')
const viewport={innerHeight:800,innerWidth:1200}
function fields(){
 const panel={getBoundingClientRect:()=>({top:100,bottom:700,left:0,right:1000}),contains:()=>false}
 const group={getAttribute:()=> 'hero-board'}
 const hero={value:'亚索',placeholder:'',dataset:{siteSearch:'hero',searchPlaceholder:''},disabled:false,getClientRects:()=>[{}],closest:s=>s==='[data-search-group]'?group:null}
 const detail={...hero,value:'',dataset:{siteSearch:'detail',searchPlaceholder:''},closest:s=>s==='[data-search-group]'?group:panel}
 const root={activeElement:null,querySelector:()=>null,querySelectorAll:()=>[hero,detail]}
 return {hero,detail,root}
}
test('placeholder follows first target and focus switching, preserving typed values',()=>{
 const {hero,detail,root}=fields()
 updateSearchShortcutHints(root,viewport)
 assert.equal(detail.placeholder,'Ctrl+F 搜索');assert.equal(hero.placeholder,'')
 root.activeElement=detail;updateSearchShortcutHints(root,viewport)
 assert.equal(hero.placeholder,'Ctrl+F 切换搜索框');assert.equal(detail.placeholder,'')
 root.activeElement=hero;updateSearchShortcutHints(root,viewport)
 assert.equal(detail.placeholder,'Ctrl+F 切换搜索框');assert.equal(hero.placeholder,'')
 assert.equal(hero.value,'亚索')
})
test('closing detail moves hint back to board and restores other original placeholders',()=>{
 const {hero,detail,root}=fields()
 detail.dataset.searchPlaceholder='符文名';detail.getClientRects=()=>[]
 updateSearchShortcutHints(root,viewport)
 assert.equal(hero.placeholder,'Ctrl+F 搜索');assert.equal(detail.placeholder,'符文名')
})

test('rune detail without a search field keeps the board search hint available',()=>{
 const {hero,root}=fields()
 hero.dataset.siteSearch='rune';hero.dataset.searchPlaceholder='符文名'
 root.querySelectorAll=()=>[hero]
 root.querySelector=selector=>selector==='.rune-detail'?{}:null
 updateSearchShortcutHints(root,viewport)
 assert.equal(hero.placeholder,'Ctrl+F 搜索')
 root.querySelector=()=>null
 updateSearchShortcutHints(root,viewport)
 assert.equal(hero.placeholder,'Ctrl+F 搜索')
})

test('phone widths clear shortcut hints and desktop resize restores them',()=>{
 const {hero,detail,root}=fields()
 updateSearchShortcutHints(root,viewport)
 for(const width of [390,700]){
  root.activeElement=detail
  updateSearchShortcutHints(root,{...viewport,innerWidth:width})
  assert.equal(hero.placeholder,'');assert.equal(detail.placeholder,'')
 }
 updateSearchShortcutHints(root,{...viewport,innerWidth:701})
 assert.equal(hero.placeholder,'Ctrl+F 切换搜索框')
 assert.equal(hero.value,'亚索')
})
