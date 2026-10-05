import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import ts from 'typescript'
import {ref} from 'vue'
import {loadTS} from './load-ts.mjs'
const {isSearchSubmit}=await loadTS('../src/search.ts')
const {heroSuggestions}=await loadTS('../src/heroSuggestions.ts')
const source=readFileSync(new URL('../src/SearchBox.vue',import.meta.url),'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const script=ts.transpile(source.replace(/^import .*$/gm,''),{target:ts.ScriptTarget.ES2022})
function harness(){
 const model=ref(''),events=[]
 const api=new Function('ref','defineModel','defineEmits','defineProps','isSearchSubmit','handleSearchArrow',script+';return {onInput,onCompositionStart,onCompositionEnd,onKeydown}')(
  ref,()=>model,()=> (...args)=>events.push(args),()=>({scope:'hero'}),isSearchSubmit,()=>false)
 return {...api,model,events}
}
const hero={championId:81,id:'81',name:'伊泽瑞尔',role:'AD',column:'AD输出',games:100,winRate:.51,pickRate:1,lowSample:false}
test('IME preedit pinyin matches before confirmation, including syllable apostrophes',()=>{
 const box=harness();box.onCompositionStart()
 for(const value of ['yi','yize',"yi'ze"]){
  box.onInput({target:{value},isComposing:true})
  assert.equal(box.model.value,value)
  assert.equal(heroSuggestions([hero],box.model.value)[0]?.championId,81)
 }
 box.onCompositionEnd({target:{value:'伊泽'}})
 assert.equal(box.model.value,'伊泽')
 assert.equal(heroSuggestions([hero],box.model.value)[0]?.championId,81)
})
test('IME owns Enter, arrows and Escape until composition ends',()=>{
 const box=harness();box.onCompositionStart()
 for(const key of ['Enter','ArrowUp','ArrowDown','Escape'])box.onKeydown({key,isComposing:false,keyCode:13,preventDefault(){throw Error('IME key intercepted')}})
 assert.deepEqual(box.events,[])
 box.onCompositionEnd({target:{value:'伊泽'}})
 box.onKeydown({key:'Enter',keyCode:13,preventDefault(){},stopPropagation(){}})
 assert.equal(box.events.at(-1)[0],'submit')
})
test('cancelled composition and normal edits replace the preedit search text',()=>{
 const box=harness();box.onCompositionStart();box.onInput({target:{value:'yize'}})
 box.onCompositionEnd({target:{value:''}});assert.equal(box.model.value,'')
 box.onInput({target:{value:'亚索'}});assert.equal(box.model.value,'亚索')
})
