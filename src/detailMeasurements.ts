// Coalesce rail reads across Vue updates, resize and scroll before any writes.
type Measurement=()=>void|(()=>void)
const pending=new Set<Measurement>()
let frame=0
export function scheduleDetailMeasurement(read:Measurement){
 pending.add(read)
 if(!frame)frame=requestAnimationFrame(()=>{
  frame=0
  const reads=[...pending];pending.clear()
  const writes=reads.map(read=>read())
  for(const write of writes)write?.()
 })
}
export function cancelDetailMeasurement(read:Measurement){
 pending.delete(read)
 if(!pending.size){cancelAnimationFrame(frame);frame=0}
}
