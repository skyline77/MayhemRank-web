export interface PatchInfo {
  patch: string
  updatedAt?: string
  games?: number
}
export interface VersionInfo extends PatchInfo {
  dataPatch: string
  generation: string | null
}
export interface Manifest {
  generation: string | null
  defaultPatch: string
  patches: PatchInfo[]
}
export const dataPatch = (version: string) => version
export function resolveVersion(value: Manifest, selection: string) {
  if (!value.patches?.length || !value.patches.some(p => p.patch === value.defaultPatch))
    throw new Error('版本目录不完整')
  const options: VersionInfo[] = value.patches.map(p => ({
    ...p,
    dataPatch: p.patch,
    generation: value.generation,
  }))
  options.sort((a, b) => b.dataPatch.localeCompare(a.dataPatch, undefined, { numeric: true }))
  const selected =
    options.find(p => p.patch === selection) || options.find(p => p.patch === p.dataPatch)!
  return {
    options,
    selected,
    manifest: { ...value, generation: selected.generation, defaultPatch: selected.dataPatch },
  }
}
