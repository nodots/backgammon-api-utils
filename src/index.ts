// Re-export request types
export * from './requests'

// Re-export response types
export * from './responses'

// Re-export WebSocket event types
export * from './websocket'

// Re-export user and auth types
export * from './users'

// Re-export import context types
export * from './import-context'

// Re-export caching utilities
export { createRequestCache } from './cache'
export type { RequestCache } from './cache'

// Re-export request coalescing utilities
export {
  createRequestCoalescer,
  createCachedCoalescedFetcher,
} from './coalesce'
export type { RequestCoalescer, CachedCoalescedFetcher } from './coalesce'

// Re-export serialization utilities
export {
  mapToObject,
  isArrayLike,
  transformForSerialization,
  transformGameResponse,
  transformGameForTransport,
  parseDate,
  hydrateDates,
} from './serialization'

// Re-export position-ID decoding + coordinate-frame helpers. Browser-safe:
// no core, no native addons, no Node-only globals. Use these from the
// client for rendering historical positions and from the api for hint
// text + PR region classification.
export {
  decodePositionId,
  importFromDecoded,
  buildBoardFromImport,
  boardFromPositionId,
  calculatePipCount,
  fromGnuFrame,
  toGnuFrame,
  classifyRegion,
  type DecodedGnuBoard,
  type OnRollContext,
  type BoardRegion,
} from './position'

// Specific exports for clarity
export type { BackgammonGamePreferences, GamePreferences } from './users'

// Import ApiResponse for use in helper functions
import { ApiResponse } from './responses'

// Legacy response types (kept for backwards compatibility)
export interface ApiErrorResponse {
  success: false
  error: string
  message?: string
}

export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
}

// Helper functions
export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data
  }
}

export function createErrorResponse(error: string, message?: string): ApiErrorResponse {
  return {
    success: false,
    error,
    message
  }
}

export function isApiError(response: ApiResponse): response is ApiErrorResponse {
  return !response.success
}

export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success
}