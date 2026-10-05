export interface DetailCell {
 id:string;name:string;icon:string;noBoots?:boolean;games:number;wins:number;pickRate:number;
 winRate:number;rawWinRate:number;interval:number[];lowSample:boolean
}
export interface RoleDetail {games:number;augmentGames:number;groups:Record<string,DetailCell[]>}
export interface DetailPayload {
 meta:{patch:string;snapshotId?:string;queue:number;region:string;source:string;from:string;cutoff:string;minimumGames:number};
 roles:Record<string,RoleDetail>
}
const cache=new Map<string,Promise<DetailPayload>>()
export function loadBuildDetail(championId:number,patch:string,snapshotId?:string):Promise<DetailPayload>{
 const key=(snapshotId || 'legacy')+':'+patch+':'+championId
 if(!cache.has(key)){
  const request=fetch((snapshotId?'/snapshots/'+snapshotId+'/'+patch:'')+'/build-details/'+championId+'.json?v=item-1pct-v5',{signal:AbortSignal.timeout(15000)})
   .then(async response=>{
    if(!response.ok) throw new Error('流派详情暂时无法读取')
    const data=await response.json() as DetailPayload
    if(data.meta.patch!==patch || data.meta.queue!==2400 || (snapshotId && data.meta.snapshotId!==snapshotId)) throw new Error('详情版本与榜单不一致')
    return data
   }).catch(error=>{cache.delete(key);throw error})
  cache.set(key,request)
 }
 return cache.get(key)!
}

export function winRateDelta(winRate:number, baseline:number):string {
 const rounded=Number(((winRate-baseline)*100).toFixed(1))
 return `${rounded>0?'+':''}${rounded.toFixed(1)}%`
}
