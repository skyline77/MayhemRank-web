// Keep identities in place while replacing their statistics with the current cohort.
// Only newly visible entries are appended; available includes entries below display thresholds.
export function reconcileLockedOrder<T extends {id:string}>(previous:readonly T[],current:readonly T[],missing:(cell:T)=>T,available:readonly T[]=current):T[]{
 const byId=new Map(available.map(cell=>[cell.id,cell]))
 const known=new Set(previous.map(cell=>cell.id))
 return [...previous.map(cell=>byId.get(cell.id) ?? missing(cell)),...current.filter(cell=>!known.has(cell.id))]
}
export interface HorizontalBounds {left:number;right:number}
export function matchingScrollOffset(view:HorizontalBounds,matches:readonly HorizontalBounds[],scrollLeft:number):number|null {
 if(!matches.length || matches.some(box=>box.left>=view.left-1 && box.right<=view.right+1))return null
 return Math.max(0,scrollLeft+matches[0]!.left-view.left)
}
