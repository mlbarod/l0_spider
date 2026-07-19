export function getLruEntry(cache, key) {
  if (!cache.has(key)) return undefined
  const value = cache.get(key)
  cache.delete(key)
  cache.set(key, value)
  return value
}

export function setLruEntry(cache, key, value, maxEntries) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("maxEntries는 1 이상의 정수여야 합니다.")
  }

  cache.delete(key)
  cache.set(key, value)
  while (cache.size > maxEntries) {
    cache.delete(cache.keys().next().value)
  }
  return value
}
