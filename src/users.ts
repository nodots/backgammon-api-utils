/**
 * User and Authentication Types
 *
 * These types define user-related data structures shared between API and clients.
 */

import type { Request } from 'express'

/**
 * User preference object
 */
export type Preference = { key: string; value: string | object }

/**
 * Backgammon-specific game preferences
 */
export type BackgammonGamePreferences = {
  diceAutoRoll: boolean
  boardTheme?: string
  showMoveHints?: boolean
}

/**
 * All game preferences organized by game type
 */
export type GamePreferences = {
  backgammon?: BackgammonGamePreferences
  // Future games can be added here
  // chess?: ChessGamePreferences
  // checkers?: CheckersGamePreferences
}

/**
 * User preferences
 */
export type UserPreferences = {
  username?: string
  gender?: string
  imageUri?: string
  games?: GamePreferences
  locale?: string
  theme?: string
  notifications?: boolean
  /** Username on eXtreme Gammon for matching imported games */
  xgUsername?: string
  /** Username on Backgammon Galaxy for matching imported games */
  bgUsername?: string
}

/**
 * User state values
 */
export type UserState =
  | 'playing'
  | 'seeking'
  | 'suspended'
  | 'banned'
  | 'pending'
  | 'inactive'
  | 'logged-in'

/**
 * User type values
 */
export type UserType = 'human' | 'robot'

/**
 * Robot kind - distinguishes between playable robots (with AI) and import-only robots
 */
export type RobotKind = 'playable' | 'import-only'

/**
 * Skill level for robots
 */
export type SkillLevel = 'novice' | 'beginner' | 'casual' | 'intermediate' | 'advanced' | 'expert' | 'worldclass' | 'grandmaster'

/**
 * Robot skill configuration - controls GNU backgammon AI strength
 */
export interface SkillConfig {
  /** Evaluation depth (1-3, higher = stronger) */
  evalPlies?: number
  /** Move filter breadth (0=Tiny, 1=Narrow, 2=Normal, 3=Large, 4=Huge) */
  moveFilter?: number
  /** Random noise (0-1.0, higher = weaker/more random) */
  noise?: number
  /** Enable pruning optimization */
  usePruning?: boolean
  /** Skill level label */
  skillLevel?: SkillLevel
}

/**
 * External user representation (from Auth0 or other auth providers)
 */
export type ExternalUser = {
  source: string
  externalId: string
  email: string
  userType: UserType
  token?: string
  state?: UserState
  nickname?: string
  firstName?: string
  lastName?: string
  imageUri?: string
  preferences?: UserPreferences
  locale?: string
  lastActive?: Date
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Standard User type for API responses
 */
export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  nickname?: string
  imageUri?: string
  userType: UserType
  state: UserState
  lastActive: Date
  createdAt: Date
  updatedAt: Date
  preferences?: UserPreferences
  // User stats - updated after every game played or imported
  averagePR?: string | null
  gamesAnalyzed?: number
  totalMovesAnalyzed?: number
  errorsDoubtful?: number
  errorsError?: number
  errorsBlunder?: number
  errorsVeryBad?: number
  statsUpdatedAt?: Date | null
  // Robot skill configuration - only used for robot users
  skillConfig?: SkillConfig | null
}

/**
 * Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string // Auth0 user ID
    email?: string
    name?: string
    [key: string]: any
  }
}

/**
 * Determine if a robot user is playable (has AI) or import-only.
 * Robots with skillConfig are playable, those without are for imports only.
 */
export function getRobotKind(user: User): RobotKind {
  if (user.userType !== 'robot') {
    throw new Error('getRobotKind called on non-robot user')
  }
  return user.skillConfig ? 'playable' : 'import-only'
}

/**
 * Check if a robot user is playable (has AI and can be selected as opponent).
 */
export function isPlayableRobot(user: User): boolean {
  return user.userType === 'robot' && user.skillConfig !== null && user.skillConfig !== undefined
}

/**
 * Check if a robot user is import-only (no AI, used for imported games).
 */
export function isImportOnlyRobot(user: User): boolean {
  return user.userType === 'robot' && (user.skillConfig === null || user.skillConfig === undefined)
}

/**
 * Filter a list of users to only include playable robots.
 */
export function filterPlayableRobots(users: User[]): User[] {
  return users.filter(isPlayableRobot)
}
