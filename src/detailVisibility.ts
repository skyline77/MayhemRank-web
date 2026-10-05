import {detailHeaderMotion} from './detailHeaderMotion'
// Keep header pinning tied to visible details, including team details and the
// two panels temporarily mounted during a handoff. No per-scroll DOM polling.
export function observeDetailVisibility(root:HTMLElement){
 const panels=new Map<Element,boolean>()
 let frame=0,disposeMotion=()=>{}
 function stopMotion(){cancelAnimationFrame(frame);disposeMotion();disposeMotion=()=>{}}
 function animateHeader(panel:HTMLElement,hiding:boolean){
  stopMotion()
  const motion=detailHeaderMotion(panel,hiding)
  disposeMotion=motion.dispose
  const started=performance.now()
  function tick(time:number){
   if(document.documentElement.classList.contains('is-detail-moving')){stopMotion();return}
   const progress=Math.min(1,(time-started)/320)
   motion.progress(1-Math.pow(1-progress,3))
   if(progress<1)frame=requestAnimationFrame(tick)
   else stopMotion()
  }
  frame=requestAnimationFrame(tick)
 }
 const update=()=>{
  const visible=[...panels.values()].some(Boolean)
  if(visible)root.classList.add('has-shown-detail')
  const wasVisible=root.classList.contains('has-visible-detail')
  const canAnimate=!document.documentElement.classList.contains('is-detail-moving') && !matchMedia('(prefers-reduced-motion: reduce)').matches
  if(!wasVisible && visible){
   // Capture the still-pinned header before the visibility class unpins it.
   const entering=[...panels.keys()].find(panel=>panels.get(panel) && panel.isConnected && panel.getBoundingClientRect().top<0)
   if(canAnimate && entering instanceof HTMLElement)animateHeader(entering,true)
   else stopMotion()
  }
  root.classList.toggle('has-visible-detail',visible)
  if(wasVisible && !visible){
   const above=[...panels.keys()].find(panel=>panel.isConnected && panel.getBoundingClientRect().bottom<=0)
   if(canAnimate && above instanceof HTMLElement)animateHeader(above,false)
   else stopMotion()
  }
 }
 const intersection=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(panels.has(entry.target))panels.set(entry.target,entry.isIntersecting)
  }
  update()
 })
 const sync=()=>{
  const current=new Set(Array.from(root.querySelectorAll('.build-detail')))
  for(const panel of panels.keys()){
   if(!current.has(panel)){intersection.unobserve(panel);panels.delete(panel)}
  }
  for(const panel of current){
   if(!panels.has(panel)){panels.set(panel,false);intersection.observe(panel)}
  }
  update()
 }
 const mutations=new MutationObserver(sync)
 mutations.observe(root,{childList:true,subtree:true})
 sync()
 return ()=>{stopMotion();mutations.disconnect();intersection.disconnect();panels.clear();root.classList.remove('has-visible-detail');root.classList.remove('has-shown-detail')}
}
