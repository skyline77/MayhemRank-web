import fallbackManifest from './generated/augment-icon-fallbacks.json'
import manifest from './generated/augment-icons.json'
const icons: Record<string, Record<string, string>> = manifest
// Versions have separate mappings; an unknown version keeps its own catalogue icon.
export function augmentIcon(id: string | number, patch: string, fallback: string): string {
    return icons[patch]?.[String(id)] || fallback
}

const fallbacks: Record<string, string[]> = fallbackManifest
export function needsGoldTint(id: string | number, patch: string, rarity: string): boolean {
    return rarity === 'kGold' && (fallbacks[patch]?.includes(String(id)) ?? false)
}
