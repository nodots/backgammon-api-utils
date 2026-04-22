# @nodots/backgammon-api-utils

Shared request, response, and WebSocket event contracts for the [Nodots Backgammon](https://backgammon.nodots.com) API, plus utility helpers for envelope construction, in-memory caching, and request coalescing.

## Install

```sh
npm install @nodots/backgammon-api-utils
```

## What's in the package

| Module | Purpose |
| --- | --- |
| `requests`, `responses` | Strongly-typed REST request and response shapes. |
| `websocket` | Event and envelope types for the live game WebSocket. |
| `users` | User, preferences, and session types (including `BackgammonGamePreferences`). |
| `import-context` | Context carried through `.mat` / `.xg` match imports. |
| `createRequestCache`, `RequestCache` | In-memory TTL cache for idempotent GETs. |
| `RequestCoalescer`, `CachedCoalescedFetcher` | Deduplicate concurrent in-flight requests for the same key. |
| `createSuccessResponse`, `createErrorResponse`, `isApiSuccess`, `isApiError` | Envelope helpers for both API authors and consumers. |

## Example

Typed success and error envelopes on both sides of the wire:

```ts
import {
  createSuccessResponse,
  createErrorResponse,
  isApiSuccess,
  type ApiResponse,
} from '@nodots/backgammon-api-utils'
import type { BackgammonGame } from '@nodots/backgammon-types'

// Server side
function getGame(id: string): ApiResponse<BackgammonGame> {
  const game = loadGame(id)
  return game
    ? createSuccessResponse(game)
    : createErrorResponse('not_found', `game ${id} not found`)
}

// Client side
const response = await fetchApi<BackgammonGame>(`/games/${id}`)
if (isApiSuccess(response)) {
  // response.data is typed as BackgammonGame
}
```

Coalesce concurrent reads for the same resource:

```ts
import { createRequestCache } from '@nodots/backgammon-api-utils'

const cache = createRequestCache({ ttlMs: 30_000 })
const game = await cache.get(`game:${id}`, () => fetchGame(id))
```

## Ecosystem

| Package | Role |
| --- | --- |
| [`@nodots/backgammon-types`](https://www.npmjs.com/package/@nodots/backgammon-types) | Discriminated-union type contracts. |
| [`@nodots/backgammon-core`](https://www.npmjs.com/package/@nodots/backgammon-core) | Game logic. |
| [`@nodots/backgammon-ai`](https://www.npmjs.com/package/@nodots/backgammon-ai) | GNU-backed robot move selection. |
| [`@nodots/backgammon-api-utils`](https://www.npmjs.com/package/@nodots/backgammon-api-utils) | API utilities (this package). |
| [`@nodots/backgammon-cli`](https://www.npmjs.com/package/@nodots/backgammon-cli) | Terminal client (`ndbg`). |
| [`@nodots/gnubg-hints`](https://www.npmjs.com/package/@nodots/gnubg-hints) | Native GNU Backgammon hints addon. |

Hosted product: [backgammon.nodots.com](https://backgammon.nodots.com).

## License

GPL-3.0. See [`LICENSE`](./LICENSE).
