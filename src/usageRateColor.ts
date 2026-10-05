// 使用率为0到1的小数；0～0.5%保持灰色，5%及以上达到完整黄色。
export function usageRateColor(value:number|null|undefined):string{
 if(value==null || !Number.isFinite(value) || value<=.005)return 'var(--muted)'
 const strength=Math.min(100,(value-.005)/(.05-.005)*100)
 return `color-mix(in oklab, var(--muted), var(--usage-yellow) ${Number(strength.toFixed(6))}%)`
}
