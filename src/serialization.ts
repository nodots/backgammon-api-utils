/**
 * Type-safe transformation helpers for API responses.
 *
 * Historically this module bridged Set→Array because core.activePlay.moves
 * was a Set. After issue #159 moves are always Arrays, so the Set shims
 * (setToArray / ensureArray) have been removed as dead code. Map and
 * deep-object helpers remain for the transport pipeline.
 */

/**
 * Converts a Map to a plain object.
 * Useful for serializing Map structures in API responses.
 *
 * @param map A Map with string keys
 * @returns A plain object with the same key-value pairs
 */
export function mapToObject<K extends string | number, V>(
  map: Map<K, V> | null | undefined
): Record<string, V> {
  if (!map) {
    return {}
  }
  const result: Record<string, V> = {}
  map.forEach((value, key) => {
    result[String(key)] = value
  })
  return result
}

/**
 * Type guard to check if a value looks like an Array (has length and numeric indexing).
 * Useful when dealing with JSON-parsed data that might be serialized Sets.
 */
export function isArrayLike(value: unknown): value is ArrayLike<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'length' in value &&
    typeof (value as ArrayLike<unknown>).length === 'number'
  )
}

/**
 * Deep transforms an object, converting all Sets to Arrays and Maps to plain objects.
 * This is a utility for ensuring API responses are JSON-serializable.
 *
 * Note: This performs a deep clone. For performance-critical paths,
 * consider using the cached version in the client's transformGameData utility.
 *
 * @param obj The object to transform
 * @returns A new object with all Sets converted to Arrays
 */
export function transformForSerialization<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Set) {
    return Array.from(obj).map((item) => transformForSerialization(item)) as T
  }

  if (obj instanceof Map) {
    const result: Record<string, unknown> = {}
    obj.forEach((value, key) => {
      result[String(key)] = transformForSerialization(value)
    })
    return result as T
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformForSerialization(item)) as T
  }

  // Plain object - transform all values
  const result: Record<string, unknown> = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = transformForSerialization((obj as Record<string, unknown>)[key])
    }
  }
  return result as T
}

/**
 * Transforms API response data specifically for BackgammonGame objects.
 * Ensures activePlay.moves is always an Array (even if the server accidentally
 * serialized it as something else or it came back as null).
 *
 * This is a type-safe wrapper around the general transformation logic.
 *
 * @param gameData The game data from an API response
 * @returns The game data with guaranteed Array types for moves
 */
export function transformGameResponse<T extends { activePlay?: { moves?: unknown } }>(
  gameData: T
): T {
  if (!gameData) {
    return gameData
  }

  const transformed = transformForSerialization(gameData)

  // Defensive: if anything sneaks through as a non-array, coerce to one.
  // Post-issue-#159 this branch should be unreachable in practice.
  if (
    transformed &&
    typeof transformed === 'object' &&
    'activePlay' in transformed &&
    transformed.activePlay
  ) {
    const activePlay = transformed.activePlay as { moves?: unknown }
    if (activePlay.moves !== undefined && !Array.isArray(activePlay.moves)) {
      activePlay.moves = []
    }
  }

  return transformed
}

/**
 * Transforms a BackgammonGame for network transport by removing redundant data.
 *
 * Removes:
 * - activePlay.board (duplicate of game.board, ~10KB savings)
 *
 * This function should be called before sending game data over REST or WebSocket.
 * The client should always use game.board for board state.
 *
 * @param gameData The game data to transform
 * @returns A new game object with redundant data removed
 */
export function transformGameForTransport<T>(gameData: T): T {
  if (!gameData) {
    return gameData
  }

  // First apply standard serialization (Set→Array, etc.)
  // Type assertion needed because transformGameResponse has a narrower constraint
  const transformed = transformForSerialization(gameData)

  // Remove activePlay.board if present (it's a duplicate of game.board)
  if (
    transformed &&
    typeof transformed === 'object' &&
    'activePlay' in transformed &&
    transformed.activePlay &&
    typeof transformed.activePlay === 'object'
  ) {
    const activePlay = transformed.activePlay as Record<string, unknown>
    if ('board' in activePlay) {
      const { board: _unusedBoard, ...activePlayWithoutBoard } = activePlay
      // Type assertion needed because we're restructuring the object
      ;(transformed as Record<string, unknown>).activePlay = activePlayWithoutBoard
    }
  }

  return transformed
}

/**
 * Date string to Date object converter.
 * JSON serialization converts Dates to ISO strings; this converts them back.
 *
 * @param dateString An ISO date string or Date object
 * @returns A Date object, or undefined if input is falsy
 */
export function parseDate(dateString: string | Date | null | undefined): Date | undefined {
  if (!dateString) {
    return undefined
  }
  if (dateString instanceof Date) {
    return dateString
  }
  return new Date(dateString)
}

/**
 * Converts Date fields in an object back to Date objects.
 * Useful for hydrating API responses that have had Dates serialized as strings.
 *
 * @param obj The object to hydrate
 * @param dateFields Array of field names that should be converted to Dates
 * @returns The object with specified fields converted to Date objects
 */
export function hydrateDates<T extends Record<string, unknown>>(
  obj: T,
  dateFields: (keyof T)[]
): T {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const result = { ...obj }
  for (const field of dateFields) {
    const value = result[field]
    if (value && typeof value === 'string') {
      result[field] = new Date(value) as T[keyof T]
    }
  }
  return result
}
