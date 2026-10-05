import {onUnmounted,ref,type Directive} from 'vue'

// 每个榜单共享一个观察器；已加载头像随滚动和排序保留。
export function useNearViewport(){
 const seen=ref(new Set<number>())
 const targets=new Map<HTMLElement,number>()
 let observer:IntersectionObserver|undefined
 const directive:Directive<HTMLElement,number>={
  mounted(element,binding){
   if(seen.value.has(binding.value))return
   if(!('IntersectionObserver' in window)){seen.value.add(binding.value);return}
   observer??=new IntersectionObserver(entries=>{
    for(const entry of entries){
     if(!entry.isIntersecting)continue
     const element=entry.target as HTMLElement,id=targets.get(element)
     if(id!==undefined)seen.value.add(id)
     observer?.unobserve(element);targets.delete(element)
    }
   },{rootMargin:Math.round(window.innerHeight/2)+'px 0px'})
   targets.set(element,binding.value);observer.observe(element)
  },
  unmounted(element){observer?.unobserve(element);targets.delete(element)}
 }
 onUnmounted(()=>{observer?.disconnect();targets.clear()})
 return {seen,directive}
}