# @nodots-llc/backgammon-api-utils

**Version 4.6.4** | Shared Utilities for API Operations

Shared utilities for Nodots Backgammon API operations, including request/response types, serialization helpers, caching, and WebSocket event definitions.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Architecture](#architecture)
- [Request Types](#request-types)
- [Response Types](#response-types)
- [Serialization Utilities](#serialization-utilities)
- [Caching](#caching)
- [WebSocket Events](#websocket-events)
- [License](#license)

---

## Features

- **Request/Response Types** - Standardized API request and response interfaces
- **Serialization Utilities** - Transform game data for JSON transport
- **Request Caching** - In-memory cache for API responses
- **Request Coalescing** - Deduplicate concurrent identical requests
- **WebSocket Events** - Event type definitions for real-time communication
- **User Types** - User preferences and authentication types

---

## Installation

```bash
npm install @nodots-llc/backgammon-api-utils
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    @nodots-llc/backgammon-api-utils                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Type Definitions                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │   │
│  │  │   Requests   │  │  Responses   │  │     User Types           │   │   │
│  │  │  (API input) │  │ (API output) │  │  (Auth, preferences)     │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Utilities                                    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │   │
│  │  │Serialization │  │   Caching    │  │   Request Coalescing     │   │   │
│  │  │ (Set→Array,  │  │ (TTL-based)  │  │  (Deduplicate requests)  │   │   │
│  │  │  Date parse) │  │              │  │                          │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     WebSocket Events                                 │   │
│  │              Event type definitions for real-time communication      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
src/
├── index.ts          # Main exports
├── requests.ts       # API request types
├── responses.ts      # API response types
├── users.ts          # User and auth types
├── serialization.ts  # JSON transform utilities
├── cache.ts          # Request caching
├── coalesce.ts       # Request coalescing
└── websocket.ts      # WebSocket event types
```

---

## Request Types

### CreateGameRequest

```typescript
import { CreateGameRequest } from '@nodots-llc/backgammon-api-utils'

const request: CreateGameRequest = {
  player1: { userId: 'user-1', isRobot: false },
  player2: { userId: 'gbg-bot', isRobot: true }
}
```

### CreateUserRequest

```typescript
import { CreateUserRequest } from '@nodots-llc/backgammon-api-utils'

const request: CreateUserRequest = {
  source: 'auth0',
  externalId: 'auth0|123456',
  email: 'user@example.com',
  given_name: 'John',
  family_name: 'Doe',
  nickname: 'johnd'
}
```

### UpdateUserRequest

```typescript
import { UpdateUserRequest } from '@nodots-llc/backgammon-api-utils'

const request: UpdateUserRequest = {
  nickname: 'newNickname',
  preferences: {
    theme: 'dark',
    language: 'en'
  }
}
```

---

## Response Types

### ApiResponse

```typescript
import {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  isApiError,
  isApiSuccess
} from '@nodots-llc/backgammon-api-utils'

// Success response
const success: ApiSuccessResponse<Game> = {
  success: true,
  data: gameObject
}

// Error response
const error: ApiErrorResponse = {
  success: false,
  error: 'NOT_FOUND',
  message: 'Game not found'
}

// Type guards
if (isApiError(response)) {
  console.error(response.error)
} else if (isApiSuccess(response)) {
  console.log(response.data)
}
```

### Helper Functions

```typescript
import {
  createSuccessResponse,
  createErrorResponse
} from '@nodots-llc/backgammon-api-utils'

// Create success response
const success = createSuccessResponse({ id: '123', name: 'Test' })

// Create error response
const error = createErrorResponse('VALIDATION_ERROR', 'Invalid input')
```

---

## Serialization Utilities

### Set to Array

```typescript
import { setToArray, ensureArray } from '@nodots-llc/backgammon-api-utils'

// Convert Set to Array
const set = new Set([1, 2, 3])
const array = setToArray(set) // [1, 2, 3]

// Ensure value is array
const result = ensureArray(possibleSet) // Always returns array
```

### Game Transformation

```typescript
import {
  transformGameResponse,
  transformGameForTransport
} from '@nodots-llc/backgammon-api-utils'

// Transform game for JSON response
const transportGame = transformGameForTransport(game)

// Transform API response for client consumption
const clientGame = transformGameResponse(apiResponse)
```

### Date Handling

```typescript
import { parseDate, hydrateDates } from '@nodots-llc/backgammon-api-utils'

// Parse ISO date string
const date = parseDate('2025-01-15T10:30:00Z')

// Hydrate all date fields in object
const hydrated = hydrateDates(apiResponse, ['createdAt', 'updatedAt'])
```

---

## Caching

### Request Cache

```typescript
import { createRequestCache, RequestCache } from '@nodots-llc/backgammon-api-utils'

// Create cache with 5 minute TTL
const cache = createRequestCache<Game>(5 * 60 * 1000)

// Get or fetch
const game = await cache.getOrFetch('game-123', async () => {
  return await api.games.get('game-123')
})

// Invalidate
cache.invalidate('game-123')

// Clear all
cache.clear()
```

---

## Request Coalescing

### Coalescer

```typescript
import { createRequestCoalescer } from '@nodots-llc/backgammon-api-utils'

// Create coalescer - identical concurrent requests share one fetch
const coalescer = createRequestCoalescer<Game>()

// Multiple calls with same key resolve to same promise
const [game1, game2] = await Promise.all([
  coalescer.coalesce('game-123', () => api.games.get('game-123')),
  coalescer.coalesce('game-123', () => api.games.get('game-123'))
])
// Only ONE API call is made
```

### Cached Coalesced Fetcher

```typescript
import { createCachedCoalescedFetcher } from '@nodots-llc/backgammon-api-utils'

// Combines caching and coalescing
const fetcher = createCachedCoalescedFetcher<Game>(60000) // 1 min TTL

const game = await fetcher.fetch('game-123', () => api.games.get('game-123'))
```

---

## WebSocket Events

### Event Types

```typescript
import { WebSocketEvent, GameEvent } from '@nodots-llc/backgammon-api-utils'

// Game events
type GameEvent =
  | 'game-created'
  | 'game-updated'
  | 'game-deleted'
  | 'move-made'
  | 'turn-confirmed'
  | 'game-completed'

// User events
type UserEvent =
  | 'user-joined'
  | 'user-left'
  | 'user-updated'
```

### Event Payloads

```typescript
interface GameUpdatedPayload {
  gameId: string
  game: BackgammonGame
  timestamp: string
}

interface MoveMadePayload {
  gameId: string
  playerId: string
  move: {
    checkerId: string
    origin: number
    destination: number
  }
}
```

---

## User Types

### User Preferences

```typescript
import { UserPreferences, BackgammonGamePreferences } from '@nodots-llc/backgammon-api-utils'

interface UserPreferences {
  theme?: 'light' | 'dark'
  language?: string
  boardTheme?: string
  soundEnabled?: boolean
  gamePreferences?: BackgammonGamePreferences
}

interface BackgammonGamePreferences {
  autoRoll?: boolean
  showPipCount?: boolean
  showHints?: boolean
  animationSpeed?: 'slow' | 'normal' | 'fast'
}
```

---

## Usage with API and Client

### API Server

```typescript
import {
  CreateGameRequest,
  createSuccessResponse,
  createErrorResponse,
  transformGameForTransport
} from '@nodots-llc/backgammon-api-utils'

app.post('/games', async (req, res) => {
  const request: CreateGameRequest = req.body

  try {
    const game = await createGame(request)
    res.json(createSuccessResponse(transformGameForTransport(game)))
  } catch (error) {
    res.status(400).json(createErrorResponse('CREATE_FAILED', error.message))
  }
})
```

### Client

```typescript
import {
  isApiError,
  transformGameResponse,
  createCachedCoalescedFetcher
} from '@nodots-llc/backgammon-api-utils'

const gameFetcher = createCachedCoalescedFetcher<Game>(30000)

async function loadGame(gameId: string) {
  const response = await gameFetcher.fetch(gameId, async () => {
    const res = await fetch(`/api/games/${gameId}`)
    return res.json()
  })

  if (isApiError(response)) {
    throw new Error(response.error)
  }

  return transformGameResponse(response.data)
}
```

---

## License

MIT License

Copyright (c) 2025 Ken Riley <kenr@nodots.com>
