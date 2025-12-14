/**
 * Request coalescing utility for in-flight requests.
 * Prevents duplicate simultaneous requests to the same endpoint by sharing
 * the promise of an in-flight request with subsequent callers.
 *
 * This is different from caching - coalescing only deduplicates requests
 * that are currently in progress. Once a request completes, subsequent
 * requests will make new network calls.
 */

interface InFlightRequest<T> {
  promise: Promise<T>
}

/**
 * Creates a request coalescer that deduplicates in-flight requests.
 *
 * Usage:
 * ```typescript
 * const coalescer = createRequestCoalescer<BackgammonGame>()
 *
 * // First call starts the request
 * const promise1 = coalescer.coalesce('game-123', () => fetchGame('123'))
 *
 * // Second call with same key returns the same promise (no new request)
 * const promise2 = coalescer.coalesce('game-123', () => fetchGame('123'))
 *
 * // promise1 === promise2 (same underlying request)
 * ```
 */
export function createRequestCoalescer<T>() {
  const inFlight = new Map<string, InFlightRequest<T>>()

  return {
    /**
     * Execute a request with coalescing. If a request with the same key
     * is already in flight, return its promise instead of starting a new request.
     *
     * @param key Unique identifier for the request (e.g., endpoint + params)
     * @param factory Function that creates the request promise
     * @returns Promise resolving to the request result
     */
    async coalesce(key: string, factory: () => Promise<T>): Promise<T> {
      // Check if there's already an in-flight request for this key
      const existing = inFlight.get(key)
      if (existing) {
        return existing.promise
      }

      // Create the promise and store it
      const promise = factory()
        .then((result) => {
          // Remove from in-flight once completed
          inFlight.delete(key)
          return result
        })
        .catch((error) => {
          // Remove from in-flight on error as well
          inFlight.delete(key)
          throw error
        })

      inFlight.set(key, { promise })
      return promise
    },

    /**
     * Check if a request with the given key is currently in flight.
     */
    isInFlight(key: string): boolean {
      return inFlight.has(key)
    },

    /**
     * Get the number of currently in-flight requests.
     */
    get size(): number {
      return inFlight.size
    },

    /**
     * Clear all in-flight tracking (does not cancel requests).
     * Use with caution - mainly useful for testing.
     */
    clear(): void {
      inFlight.clear()
    },
  }
}

/**
 * Type for the request coalescer instance
 */
export type RequestCoalescer<T> = ReturnType<typeof createRequestCoalescer<T>>

/**
 * Creates a combined cache + coalescing wrapper for API requests.
 * Combines TTL-based caching with in-flight request deduplication.
 *
 * Usage:
 * ```typescript
 * const fetcher = createCachedCoalescedFetcher<BackgammonGame>({
 *   ttlMs: 5000,
 *   maxEntries: 50,
 * })
 *
 * // First call: makes request, caches result
 * const game1 = await fetcher.fetch('game-123', () => fetchGame('123'))
 *
 * // Second call within TTL: returns cached result (no request)
 * const game2 = await fetcher.fetch('game-123', () => fetchGame('123'))
 *
 * // Simultaneous calls: coalesced into single request
 * const [game3, game4] = await Promise.all([
 *   fetcher.fetch('game-456', () => fetchGame('456')),
 *   fetcher.fetch('game-456', () => fetchGame('456')),
 * ])
 * ```
 */
export function createCachedCoalescedFetcher<T>(options: {
  ttlMs?: number
  maxEntries?: number
} = {}) {
  // Inline cache implementation to avoid circular imports
  const ttlMs = options.ttlMs ?? 30000
  const maxEntries = options.maxEntries ?? 100
  const cache = new Map<string, { value: T; expiresAt: number }>()
  const coalescer = createRequestCoalescer<T>()

  const getCached = (key: string): T | undefined => {
    const entry = cache.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      cache.delete(key)
      return undefined
    }
    return entry.value
  }

  const setCached = (key: string, value: T): void => {
    // Cleanup expired entries
    const now = Date.now()
    for (const [k, e] of cache.entries()) {
      if (e.expiresAt < now) cache.delete(k)
    }
    // Enforce max entries
    while (cache.size >= maxEntries) {
      const firstKey = cache.keys().next().value
      if (firstKey !== undefined) cache.delete(firstKey)
      else break
    }
    cache.set(key, { value, expiresAt: now + ttlMs })
  }

  return {
    /**
     * Fetch with caching and coalescing.
     */
    async fetch(key: string, factory: () => Promise<T>): Promise<T> {
      // Check cache first
      const cached = getCached(key)
      if (cached !== undefined) {
        return cached
      }

      // Coalesce the request
      const result = await coalescer.coalesce(key, factory)
      setCached(key, result)
      return result
    },

    /**
     * Invalidate a cached entry.
     */
    invalidate(key: string): void {
      cache.delete(key)
    },

    /**
     * Clear all cached entries.
     */
    clear(): void {
      cache.clear()
      coalescer.clear()
    },

    /**
     * Get current cache size.
     */
    get cacheSize(): number {
      return cache.size
    },

    /**
     * Get number of in-flight requests.
     */
    get inFlightSize(): number {
      return coalescer.size
    },
  }
}

/**
 * Type for the cached coalesced fetcher instance
 */
export type CachedCoalescedFetcher<T> = ReturnType<typeof createCachedCoalescedFetcher<T>>
