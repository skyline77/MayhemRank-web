/** Shared rate scale. Rates/baselines are fractions; distances are percentage points. */
export const WIN_RATE_NEUTRAL_POINTS=1
export const WIN_RATE_FULL_COLOR_POINTS=6
export function winRateColor(value:number|null|undefined,baseline=0.5):string {
 const neutral='var(--text)'
 if(value==null || !Number.isFinite(value) || !Number.isFinite(baseline))return neutral
 // Remove binary floating-point noise at the inclusive neutral boundaries.
 const points=Math.round((value-baseline)*1e12)/1e10
 const distance=Math.abs(points)
 if(distance<=WIN_RATE_NEUTRAL_POINTS)return neutral
 const strength=Math.min(100,(distance-WIN_RATE_NEUTRAL_POINTS)/(WIN_RATE_FULL_COLOR_POINTS-WIN_RATE_NEUTRAL_POINTS)*100)
 return `color-mix(in oklab, ${neutral}, var(--win-${points>0?'positive':'negative'}-3) ${Number(strength.toFixed(6))}%)`
}
