/**
 * Request caching utility with TTL-based expiration and max entries limit.
 * Used to cache API responses and prevent redundant network requests.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

interface CacheOptions {
  ttlMs?: number // Time-to-live in milliseconds (default: 30000 = 30 seconds)
  maxEntries?: number // Maximum cache entries (default: 100)
}

const DEFAULT_TTL_MS = 30000
const DEFAULT_MAX_ENTRIES = 100

/**
 * Creates a TTL-based cache for storing request responses.
 *
 * Usage:
 * ```typescript
 * const gameCache = createRequestCache<BackgammonGame>({ ttlMs: 5000, maxEntries: 50 })
 *
 * // Store a value
 * gameCache.set('game-123', gameData)
 *
 * // Retrieve a value (returns undefined if expired or not found)
 * const cached = gameCache.get('game-123')
 *
 * // Clear all entries
 * gameCache.clear()
 * ```
 */
export function createRequestCache<T>(options: CacheOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  const cache = new Map<string, CacheEntry<T>>()

  /**
   * Remove expired entries from the cache
   */
  const cleanup = (): void => {
    const now = Date.now()
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt < now) {
        cache.delete(key)
      }
    }
  }

  /**
   * Ensure cache doesn't exceed maxEntries by removing oldest entries
   */
  const enforceMaxEntries = (): void => {
    while (cache.size >= maxEntries) {
      const firstKey = cache.keys().next().value
      if (firstKey !== undefined) {
        cache.delete(firstKey)
      } else {
        break
      }
    }
  }

  return {
    /**
     * Get a cached value by key. Returns undefined if not found or expired.
     */
    get(key: string): T | undefined {
      const entry = cache.get(key)
      if (!entry) {
        return undefined
      }
      if (entry.expiresAt < Date.now()) {
        cache.delete(key)
        return undefined
      }
      return entry.value
    },

    /**
     * Store a value in the cache with the configured TTL.
     */
    set(key: string, value: T): void {
      cleanup()
      enforceMaxEntries()
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      })
    },

    /**
     * Check if a key exists and is not expired.
     */
    has(key: string): boolean {
      const entry = cache.get(key)
      if (!entry) {
        return false
      }
      if (entry.expiresAt < Date.now()) {
        cache.delete(key)
        return false
      }
      return true
    },

    /**
     * Delete a specific key from the cache.
     */
    delete(key: string): boolean {
      return cache.delete(key)
    },

    /**
     * Clear all entries from the cache.
     */
    clear(): void {
      cache.clear()
    },

    /**
     * Get the current number of entries in the cache.
     */
    get size(): number {
      cleanup()
      return cache.size
    },

    /**
     * Get or set a value - if cached value exists and is valid, return it.
     * Otherwise, call the factory function, cache the result, and return it.
     */
    async getOrSet(key: string, factory: () => Promise<T>): Promise<T> {
      const cached = this.get(key)
      if (cached !== undefined) {
        return cached
      }
      const value = await factory()
      this.set(key, value)
      return value
    },
  }
}

/**
 * Type for the request cache instance
 */
export type RequestCache<T> = ReturnType<typeof createRequestCache<T>>
