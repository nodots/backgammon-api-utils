/**
 * Import context types for game import player association.
 * Used by both API and client to handle player matching during imports.
 */

export type ImportPlatform = 'xg' | 'bg'

export type PlayerResolutionKind =
  | 'user-matched' // Matched via external username (xgUsername/bgUsername)
  | 'robot-matched' // Matched to known external robot (XG-Champion, etc.)
  | 'unknown-human' // Store name in metadata only - no user created
  | 'user-confirmed' // User manually confirmed which player they are

export interface ResolvedPlayer {
  position: 1 | 2
  externalName: string
  resolutionKind: PlayerResolutionKind
  userId: string | null // Set if matched to user or robot, null for unknown-human
  isImportingUser: boolean
}

export interface ImportPlayerContext {
  platform: ImportPlatform
  player1: ResolvedPlayer
  player2: ResolvedPlayer
  requiresUserConfirmation: boolean
  confirmationReason?: string
}

/**
 * Request body for confirming player identity during import.
 */
export interface PlayerConfirmationRequest {
  userIsPlayer: 1 | 2
  updatePreferences: boolean // If true, update user's xgUsername/bgUsername with confirmed name
}

/**
 * Response when import requires user confirmation.
 */
export interface ImportConfirmationRequired {
  success: false
  requiresConfirmation: true
  players: ImportPlayerContext
  header: {
    player1: string
    player2: string
    player1Elo?: string
    player2Elo?: string
  }
  gameCount: number
}

/**
 * Metadata stored with imported games about player resolution.
 */
export interface ImportContextMetadata {
  platform: ImportPlatform
  player1: {
    externalName: string
    resolutionKind: PlayerResolutionKind
  }
  player2: {
    externalName: string
    resolutionKind: PlayerResolutionKind
  }
}
