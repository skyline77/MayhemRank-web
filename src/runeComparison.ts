import {message} from './i18n'
import {winRateColor} from './winRateColor'
// Compare patch versions numerically, including year boundaries.
export function previousRunePatch(current:string,patches:readonly string[]):string|undefined {
 const order=(patch:string)=>{const [year,minor]=patch.split('.').map(Number);return year!*1000+minor!}
 return patches.filter(p=>order(p)<order(current)).sort((a,b)=>order(b)-order(a))[0]
}
export function runePatchChange(current:number,previous:number){
 // Round the label only; colors use the same unrounded rate scale as cards.
 const points=Math.round((current-previous)*1000)/10
 return {points,label:(points>0?'+':points===0?'±':'')+points.toFixed(1)+'%',
  color:winRateColor(current,previous)}
}

export function runeCardTrend(current:number,previous?:number){
 if(previous===undefined || !Number.isFinite(current) || !Number.isFinite(previous))return null
 // Remove floating-point noise at exact 2/4-point boundaries, without display rounding.
 const points=Math.round((current-previous)*1e12)/1e10
 const magnitude=Math.abs(points)
 if(magnitude<=2)return null
 const up=points>0,strong=magnitude>4
 return {color:winRateColor(current,previous),symbol:(up?'↑':'↓').repeat(strong?2:1),tone:(up?'up':'down')+(strong?'-strong':''),
  label:message(up?'较上版本上升{p0}个百分点':'较上版本下降{p0}个百分点',{p0:magnitude.toFixed(1)})}
}
