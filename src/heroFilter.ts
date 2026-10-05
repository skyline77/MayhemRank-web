export interface RuneFilter {id:string;name:string;icon:string}
export interface HeroFilter {role:string|null;rune:RuneFilter|null;item?:RuneFilter|null}
export type HeroFilterAction={type:'role';role:string}|{type:'rune';rune:RuneFilter}|{type:'item';item:RuneFilter}|{type:'reset';role:string}
export function heroFilter(state:HeroFilter,action:HeroFilterAction):HeroFilter{
 switch(action.type){
  case 'reset':return {role:action.role,rune:null}
  case 'role':return {role:state.role===action.role?null:action.role,rune:null}
  case 'item':return state.item?.id===action.item.id?{role:null,rune:null}:{role:null,rune:null,item:action.item}
  case 'rune':return {role:null,rune:state.rune?.id===action.rune.id?null:action.rune}
 }
}
