export function buildDetailUrl(
  championId: number,
  role: string,
  patch?: string,
  augmentId?: string,
) {
  const query = new URLSearchParams({ page: 'heroes', champion: String(championId), role })
  if (patch) query.set('patch', patch)
  if (augmentId) {
    query.delete('role')
    query.set('augment', augmentId)
  }
  return '/?' + query.toString()
}

export function runeDetailUrl(runeId: string, patch?: string) {
  const query = new URLSearchParams({ page: 'augments', rune: runeId })
  if (patch) query.set('patch', patch)
  return '/?' + query.toString()
}

export function isInlineActivation(
  event: Pick<MouseEvent, 'button' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
) {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
}

// Legacy detail URLs and new board links share one destination contract.
export function boardLink(search: string) {
  const query = new URLSearchParams(search)
  const championId = Number(query.get('champion'))
  const champion = Number.isSafeInteger(championId) && championId > 0 ? championId : null
  const rune = query.get('rune') || ''
  const page = champion
    ? 'heroes'
    : rune
      ? 'augments'
      : query.get('page') === 'combos'
        ? 'combos'
        : query.get('page') === 'augments'
          ? 'augments'
          : 'heroes'
  return {
    page,
    champion,
    rune: champion ? '' : rune,
    role: query.get('role') || '',
    augment: champion ? query.get('augment') || '' : '',
  }
}
