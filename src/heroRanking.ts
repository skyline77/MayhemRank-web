import type {BuildEntry} from './buildBoard'
export type RankedHero=BuildEntry & {roleFallback?:boolean}
export function rankHeroes(heroes:BuildEntry[],roles:BuildEntry[],mapping:Record<string,string>,strongest:boolean,minimumGames:number):RankedHero[]{
 const best=new Map<number,BuildEntry>()
 for(const role of roles){
  if(role.lowSample || role.games<minimumGames)continue
  const previous=best.get(role.championId)
  if(!previous || role.winRate>previous.winRate || role.winRate===previous.winRate && (role.games>previous.games || role.games===previous.games && role.id<previous.id))best.set(role.championId,role)
 }
 return heroes.map(hero=>{
  const role=strongest?best.get(hero.championId):undefined
  return {...(role || hero),column:mapping[String(hero.championId)] || hero.column,roleFallback:strongest && !role}
 })
}
