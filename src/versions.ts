import {locale} from './locale'
import {ref} from 'vue'
import {pushDetailHistory} from './pageHistory'
import {dataPatch,resolveVersion,type Manifest,type VersionInfo} from './versionSelection'
export type {PatchInfo} from './versionSelection'
export const selectedVersion=ref(new URLSearchParams(location.search).get('patch') || '')
export const defaultVersion=ref('')
export const selectedPatch=ref(dataPatch(selectedVersion.value))
export const availablePatches=ref<VersionInfo[]>([])
export const snapshotGeneration=ref<string|null>(null)
let request:Promise<Manifest>|undefined
export function loadVersions(){
 if(!request) request=fetch('/api/snapshots',{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async response=>{
  if(!response.ok)throw new Error('版本目录暂时无法读取')
  return await response.json() as Manifest
 }).catch(error=>{request=undefined;throw error})
 return request.then(value=>{
  const resolved=resolveVersion(value,selectedVersion.value)
  defaultVersion.value=resolveVersion(value,'').selected.patch
  availablePatches.value=resolved.options
  selectedVersion.value=resolved.selected.patch
  selectedPatch.value=resolved.selected.dataPatch
  snapshotGeneration.value=resolved.selected.generation
  const url=new URL(location.href)
  setVersionUrl(url,selectedVersion.value)
  if(url.href!==location.href)history.replaceState(history.state,'',url.pathname+url.search+url.hash)
  return resolved.manifest
 })
}
function setVersionUrl(url:URL,version:string){
 const home=(!url.searchParams.get('page') || url.searchParams.get('page')==='heroes') && !url.searchParams.has('champion') && !url.searchParams.has('rune')
 if(home){url.searchParams.delete('page')}
 if(home && version===defaultVersion.value)url.searchParams.delete('patch')
 else url.searchParams.set('patch',version)
}
export function choosePatch(version:string){
 if(!availablePatches.value.some(p=>p.patch===version) || version===selectedVersion.value)return
 const url=new URL(location.href);setVersionUrl(url,version)
 // Keep every board mounted; its version watcher refreshes data in place.
 pushDetailHistory(url.pathname+url.search+url.hash)
 selectedVersion.value=version
 selectedPatch.value=dataPatch(version)
 snapshotGeneration.value=availablePatches.value.find(p=>p.patch===version)!.generation
}
export function updateDate(value?:string){
 if(!value || Number.isNaN(Date.parse(value)))return ''
 return new Intl.DateTimeFormat(locale.value,{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric'}).format(new Date(value))
}
