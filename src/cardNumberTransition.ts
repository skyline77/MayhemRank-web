// Temporary, aria-hidden clones animate numbers without mutating Vue-owned text.
export function interpolateNumberText(from:string,to:string,progress:number):string{
 const pattern=/[+-]?\d[\d,]*(?:\.\d+)?/g
 const starts=from.match(pattern),ends=to.match(pattern)
 if(!starts || !ends || starts.length!==ends.length || from.replace(pattern,'#')!==to.replace(pattern,'#'))return progress<1?from:to
 let index=0
 return to.replace(pattern,target=>{
  const initial=Number(starts[index++]!.replaceAll(',','')),end=Number(target.replaceAll(',',''))
  const value=initial+(end-initial)*progress
  const decimals=target.split('.')[1]?.length || 0
  const formatted=Math.abs(value).toFixed(decimals)
  const [integer,fraction]=formatted.split('.')
  const grouped=target.includes(',')?integer!.replace(/\B(?=(\d{3})+(?!\d))/g,','):integer
  return (value<0?'-':target.startsWith('+')?'+':'')+grouped+(fraction===undefined?'':'.'+fraction)
 })
}
export function animateCardNumbers(previous:HTMLElement,cover:HTMLElement,delay:number,duration:number){
 const selector='.build-stat-result,.build-stat-usage'
 const oldMetrics=Array.from(previous.querySelectorAll<HTMLElement>(selector))
 const changes:{node:Text;from:string;to:string}[]=[]
 cover.querySelectorAll<HTMLElement>(selector).forEach((metric,index)=>{
  const old=oldMetrics[index]
  if(!old)return
  const textNodes=(root:HTMLElement)=>{
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes:Text[]=[]
   while(walker.nextNode())nodes.push(walker.currentNode as Text)
   return nodes.filter(node=>/\d/.test(node.data))
  }
  const starts=textNodes(old),ends=textNodes(metric)
  if(starts.length!==ends.length)return
  ends.forEach((node,i)=>{
   const from=starts[i]!.data,to=node.data
   if(from===to)return
   changes.push({node,from,to});node.data=from
  })
 })
 let frame=0
 const start=performance.now()+delay
 function tick(now:number){
  const progress=Math.min(1,Math.max(0,(now-start)/duration))
  const eased=1-Math.pow(1-progress,3)
  changes.forEach(({node,from,to})=>{node.data=progress===1?to:interpolateNumberText(from,to,eased)})
  if(progress<1)frame=requestAnimationFrame(tick)
 }
 if(changes.length)frame=requestAnimationFrame(tick)
 return ()=>cancelAnimationFrame(frame)
}
