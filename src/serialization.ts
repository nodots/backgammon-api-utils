/**
 * Type-safe transformation helpers for API responses.
 * Centralizes Set→Array conversion logic and other serialization concerns.
 *
 * JSON serialization cannot represent JavaScript Sets and Maps natively.
 * The core library uses Set for game.activePlay.moves, but API responses
 * must serialize these as Arrays. This module provides utilities to handle
 * the conversion in a centralized, type-safe manner.
 */

/**
 * Converts a Set to an Array if it's a Set, otherwise returns the value as-is.
 * Handles null/undefined gracefully.
 *
 * @param value A Set, Array, or null/undefined
 * @returns An Array (possibly empty) or the original value if already an array
 */
export function setToArray<T>(value: Set<T> | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return []
  }
  if (value instanceof Set) {
    return Array.from(value)
  }
  if (Array.isArray(value)) {
    return value
  }
  // Fallback for any iterable-like object (defensive)
  return Array.from(value)
}

/**
 * Ensures a value is an Array. If it's a Set, converts it.
 * If it's null/undefined, returns empty array.
 * If it's already an Array, returns it.
 *
 * Use this when you need to guarantee an Array result.
 */
export function ensureArray<T>(value: Set<T> | T[] | null | undefined): T[] {
  return setToArray(value)
}

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

  // Ensure activePlay.moves is an array (defensive)
  if (
    transformed &&
    typeof transformed === 'object' &&
    'activePlay' in transformed &&
    transformed.activePlay
  ) {
    const activePlay = transformed.activePlay as { moves?: unknown }
    if (activePlay.moves !== undefined && !Array.isArray(activePlay.moves)) {
      activePlay.moves = ensureArray(activePlay.moves as Set<unknown> | unknown[])
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
