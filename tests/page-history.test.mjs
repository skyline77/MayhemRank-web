import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
const js=ts.transpile(readFileSync(new URL('../src/pageHistory.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS})
function setup(type='back_forward',url='https://example.test/',saved={}){
 const listeners=new Map(),frames=new Map(),timers=new Map()
 let serial=0
 const env={exports:{},location:{href:url},performance:{getEntriesByType:()=>[{type}]},scrollX:0,scrollY:0,innerHeight:800,innerWidth:1200,
  history:{scrollRestoration:'auto',state:{other:'preserved',teamPageViewV1:{url:'https://example.test/',sections:{board:{selected:'4:AP',query:'卡牌'}},x:0,y:400,anchor:{id:'detail',top:60},rails:[],...saved}},replaceState(value){this.state=value}},
  busy:true,anchorTop:500,observer:null,
  requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id},cancelAnimationFrame(id){frames.delete(id)},
  clearTimeout(id){timers.delete(id)},MutationObserver:class {constructor(cb){this.cb=cb;env.observer=this}observe(){}disconnect(){this.disconnected=true}}}
 const panel={id:'detail',getBoundingClientRect:()=>({top:env.anchorTop-env.scrollY,bottom:env.anchorTop+600-env.scrollY}),querySelectorAll:()=>[]}
 env.document={documentElement:{},fonts:{ready:Promise.resolve()},getElementById:id=>id==='detail'?panel:null,
  querySelector:selector=>selector==='main'?{}:env.busy?{}:null,querySelectorAll:()=>[panel]}
 env.window={setTimeout(fn){const id=++serial;timers.set(id,fn);return id},addEventListener(name,fn){listeners.set(name,fn)},removeEventListener(name){listeners.delete(name)},scrollTo({left,top}){env.scrollX=left;env.scrollY=top}}
 vm.runInNewContext(js,env)
 return {api:env.exports,env,listeners,frames,flush(){for(let i=0;frames.size && i<30;i++){const [id,fn]=frames.entries().next().value;frames.delete(id);fn()}}}
}
test('only this history entry restores on back/forward, once per component',()=>{
 const {api}=setup()
 assert.equal(api.readHistorySection('board').selected,'4:AP')
 assert.equal(api.readHistorySection('board'),undefined)
 assert.equal(setup('navigate').api.readHistorySection('board'),undefined)
 assert.equal(setup('reload').api.readHistorySection('board'),undefined)
 assert.equal(setup('back_forward','https://example.test/?rune=1').api.readHistorySection('board'),undefined)
})
test('pagehide saves current selection and anchor without overwriting other history state',()=>{
 const {api,env,listeners}=setup('navigate')
 const remove=api.registerHistorySection('board',()=>({selected:'114:战士',query:'剑姬'}))
 const stop=api.installPageHistory()
 env.scrollY=320;listeners.get('pagehide')()
 assert.equal(env.history.state.other,'preserved')
 assert.equal(env.history.state.teamPageViewV1.sections.board.selected,'114:战士')
 assert.equal(env.history.state.teamPageViewV1.anchor.top,180)
 remove();listeners.get('pagehide')()
 assert.equal(env.history.state.teamPageViewV1.sections.board,undefined)
 stop();assert.equal(listeners.has('pagehide'),false)
})
test('waits for async detail data, then restores relative position and releases native restoration',async()=>{
 const {api,env,flush}=setup()
 api.installPageHistory()
 assert.equal(env.history.scrollRestoration,'manual')
 assert.equal(env.scrollY,0)
 await env.observer.cb();flush();assert.equal(env.scrollY,0)
 env.busy=false
 await env.observer.cb();flush()
 assert.equal(env.scrollY,440)
 assert.equal(env.anchorTop-env.scrollY,60)
 assert.equal(env.history.scrollRestoration,'auto')
 assert.equal(env.observer.disconnected,true)
})
test('user scrolling cancels a pending restoration instead of fighting the user',async()=>{
 const {api,env,listeners,flush}=setup()
 api.installPageHistory();listeners.get('wheel')()
 env.busy=false;env.scrollY=200
 await env.observer.cb();flush()
 assert.equal(env.scrollY,200)
 assert.equal(env.history.scrollRestoration,'auto')
})
