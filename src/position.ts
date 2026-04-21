import type {
  BackgammonBoard,
  BackgammonChecker,
  BackgammonCheckerContainerImport,
  BackgammonColor,
  BackgammonMoveDirection,
  BackgammonPlayerInactive,
  BackgammonPointValue,
} from '@nodots/backgammon-types'
import { v4 as uuidv4 } from 'uuid'

/**
 * Pure-TS GNU position-ID decoder, tan-array → board-import mapper,
 * pip-count helper, and coordinate-frame utilities.
 *
 * Lives in api-utils (browser-safe, no Node-only deps) so both the
 * client UI and the server API can use it without pulling in core's
 * game logic, native addons, or logger runtime.
 *
 * Convention (matches the encoder in core/src/Board/gnuPositionId.ts):
 *   TanBoard[0] (first in the bitstream) = opponent (NOT on roll)
 *   TanBoard[1] (second)                  = player on roll
 *
 * Each 25-entry tan array is indexed [0..23] for points 1..24 in that
 * player's own direction; index 24 is their bar. Callers must supply
 * an on-roll context (color + direction) to map the two arrays to
 * concrete players.
 */

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const CHECKERS_PER_PLAYER = 15

export interface DecodedGnuBoard {
  /** TanBoard[0] — opponent's checkers. 25 entries: 0-23 = points 1-24, 24 = bar. */
  opponent: number[]
  /** TanBoard[1] — player-on-roll's checkers. 25 entries: 0-23 = points 1-24, 24 = bar. */
  onRoll: number[]
}

export interface OnRollContext {
  color: BackgammonColor
  direction: BackgammonMoveDirection
}

// ─── decoder ──────────────────────────────────────────────────────────

function base64Value(ch: string): number {
  const idx = BASE64_CHARS.indexOf(ch)
  return idx >= 0 ? idx : 0
}

function keyFromPositionId(positionId: string): Uint8Array {
  if (positionId.length !== 14) {
    throw new Error(
      `Invalid position ID length: ${positionId.length}, expected 14`
    )
  }

  const key = new Uint8Array(10)
  let keyIdx = 0

  for (let i = 0; i < 3; i++) {
    const c0 = base64Value(positionId[i * 4])
    const c1 = base64Value(positionId[i * 4 + 1])
    const c2 = base64Value(positionId[i * 4 + 2])
    const c3 = base64Value(positionId[i * 4 + 3])

    key[keyIdx++] = (c0 << 2) | (c1 >> 4)
    key[keyIdx++] = ((c1 & 0x0f) << 4) | (c2 >> 2)
    key[keyIdx++] = ((c2 & 0x03) << 6) | c3
  }

  const c0 = base64Value(positionId[12])
  const c1 = base64Value(positionId[13])
  key[keyIdx] = (c0 << 2) | (c1 >> 4)

  return key
}

function boardFromKey(key: Uint8Array): DecodedGnuBoard {
  const board: DecodedGnuBoard = {
    opponent: new Array(25).fill(0),
    onRoll: new Array(25).fill(0),
  }

  let bitPos = 0

  for (let player = 0; player < 2; player++) {
    const arr = player === 0 ? board.opponent : board.onRoll

    for (let point = 0; point < 25; point++) {
      let checkerCount = 0

      while (true) {
        const byteIdx = Math.floor(bitPos / 8)
        const bitIdx = bitPos % 8

        if (byteIdx >= 10) break

        const bit = (key[byteIdx] >> bitIdx) & 1
        bitPos++

        if (bit === 0) break
        checkerCount++
      }

      arr[point] = checkerCount
    }
  }

  return board
}

/**
 * Decode a 14-character GNU Backgammon position ID.
 * Returns {opponent, onRoll} tan arrays. Pair with an on-roll context
 * via importFromDecoded to materialize a BackgammonBoard.
 * @throws Error if the position ID is not exactly 14 characters.
 */
export function decodePositionId(positionId: string): DecodedGnuBoard {
  if (!positionId || positionId.length !== 14) {
    throw new Error(
      `Invalid position ID: expected 14 characters, got ${positionId?.length ?? 0}`
    )
  }

  const key = keyFromPositionId(positionId)
  return boardFromKey(key)
}

// ─── coordinate frame ────────────────────────────────────────────────

export type BoardRegion =
  | 'bearingOff'
  | 'homeInner'
  | 'outerBoard'
  | 'opponentOuter'
  | 'opponentInner'
  | 'opponentBearing'
  | 'bar'
  | 'off'

const BAR = 25
const OFF = 0

/**
 * Flip a GNU-frame point (1-24, from on-roll's direction) into the
 * clockwise 1-24 frame used for rendering. 0 (off) and 25 (bar) pass
 * through unchanged.
 */
export function fromGnuFrame(
  point: number,
  onRollDirection: BackgammonMoveDirection
): number {
  if (point === BAR || point === OFF) return point
  if (point < 1 || point > 24) return point
  return onRollDirection === 'clockwise' ? point : 25 - point
}

/**
 * Flip a clockwise-frame point (1-24) into the GNU on-roll frame.
 * Inverse of fromGnuFrame (the transform is symmetric; the name pair
 * exists to make the direction of the flip clear at call sites).
 */
export function toGnuFrame(
  clockwisePoint: number,
  onRollDirection: BackgammonMoveDirection
): number {
  return fromGnuFrame(clockwisePoint, onRollDirection)
}

/**
 * Classify a 1-24 point number (in the owner's frame) as a board
 * region. Callers must pre-translate into the owner's direction frame
 * (use fromGnuFrame if needed).
 *
 *   1-3   = bearingOff
 *   4-6   = homeInner
 *   7-12  = outerBoard
 *   13-18 = opponentOuter
 *   19-21 = opponentInner
 *   22-24 = opponentBearing
 *   0     = off
 *   25    = bar
 */
export function classifyRegion(point: number | string): BoardRegion {
  if (point === 'bar' || point === BAR) return 'bar'
  if (point === 'off' || point === OFF) return 'off'

  const pos = typeof point === 'number' ? point : parseInt(point, 10)
  if (Number.isNaN(pos)) return 'outerBoard'

  if (pos >= 1 && pos <= 3) return 'bearingOff'
  if (pos >= 4 && pos <= 6) return 'homeInner'
  if (pos >= 7 && pos <= 12) return 'outerBoard'
  if (pos >= 13 && pos <= 18) return 'opponentOuter'
  if (pos >= 19 && pos <= 21) return 'opponentInner'
  if (pos >= 22 && pos <= 24) return 'opponentBearing'

  return 'outerBoard'
}

// ─── board-import builder ────────────────────────────────────────────

const toPointValue = (value: number): BackgammonPointValue =>
  value as BackgammonPointValue

function opponentOf(ctx: OnRollContext): OnRollContext {
  return {
    color: ctx.color === 'white' ? 'black' : 'white',
    direction: ctx.direction === 'clockwise' ? 'counterclockwise' : 'clockwise',
  }
}

/**
 * Map the two tan arrays onto BackgammonCheckerContainerImport entries.
 * `decoded.opponent` becomes the opposite of `onRoll`; `decoded.onRoll`
 * becomes `onRoll`. Each player's point indices are in that player's
 * own direction frame.
 */
export function importFromDecoded(
  decoded: DecodedGnuBoard,
  onRoll: OnRollContext
): BackgammonCheckerContainerImport[] {
  const opp = opponentOf(onRoll)
  const imports: BackgammonCheckerContainerImport[] = []

  const addPoints = (tan: number[], player: OnRollContext) => {
    for (let i = 0; i < 24; i++) {
      if (tan[i] <= 0) continue
      const playerPos = i + 1
      const clockwise =
        player.direction === 'clockwise' ? playerPos : 25 - playerPos
      const counterclockwise = 25 - clockwise
      imports.push({
        position: {
          clockwise: toPointValue(clockwise),
          counterclockwise: toPointValue(counterclockwise),
        },
        checkers: { color: player.color, qty: tan[i] },
      })
    }
    if (tan[24] > 0) {
      imports.push({
        position: 'bar',
        direction: player.direction,
        checkers: { color: player.color, qty: tan[24] },
      })
    }
  }

  addPoints(decoded.opponent, opp)
  addPoints(decoded.onRoll, onRoll)

  const onBoardCount = (tan: number[]) =>
    tan.slice(0, 24).reduce((sum, n) => sum + n, 0) + tan[24]

  const opponentOff = Math.max(
    0,
    CHECKERS_PER_PLAYER - onBoardCount(decoded.opponent)
  )
  const onRollOff = Math.max(
    0,
    CHECKERS_PER_PLAYER - onBoardCount(decoded.onRoll)
  )

  if (opponentOff > 0) {
    imports.push({
      position: 'off',
      direction: opp.direction,
      checkers: { color: opp.color, qty: opponentOff },
    })
  }
  if (onRollOff > 0) {
    imports.push({
      position: 'off',
      direction: onRoll.direction,
      checkers: { color: onRoll.color, qty: onRollOff },
    })
  }

  return imports
}

// ─── minimal browser-safe BackgammonBoard builder ───────────────────

const createCheckers = (
  qty: number,
  color: BackgammonColor,
  checkercontainerId: string
): BackgammonChecker[] =>
  Array.from({ length: qty }).map(() => ({
    id: uuidv4(),
    color,
    checkercontainerId,
    isMovable: false,
  }))

/**
 * Build a full BackgammonBoard from a BackgammonCheckerContainerImport[]
 * without touching core's Board.initialize. Browser-safe (no gnubg
 * native addon, no core game-logic dependency).
 */
export function buildBoardFromImport(
  boardImport: BackgammonCheckerContainerImport[]
): BackgammonBoard {
  const points = Array.from({ length: 24 }).map((_, idx) => {
    const clockwise = toPointValue(idx + 1)
    const counterclockwise = toPointValue(25 - clockwise)
    const pointId = uuidv4()
    const checkers: BackgammonChecker[] = []

    boardImport.forEach((cc) => {
      if (typeof cc.position === 'object' && 'clockwise' in cc.position) {
        if (
          cc.position.clockwise === clockwise &&
          cc.position.counterclockwise === counterclockwise
        ) {
          checkers.push(
            ...createCheckers(cc.checkers.qty, cc.checkers.color, pointId)
          )
        }
      }
    })

    return {
      id: pointId,
      kind: 'point' as const,
      position: { clockwise, counterclockwise },
      checkers,
    }
  })

  const barImports = boardImport.filter((cc) => cc.position === 'bar')
  const offImports = boardImport.filter((cc) => cc.position === 'off')
  const barClockwiseId = uuidv4()
  const barCounterId = uuidv4()
  const offClockwiseId = uuidv4()
  const offCounterId = uuidv4()

  const barClockwise = barImports.find((cc) => cc.direction === 'clockwise')
  const barCounter = barImports.find(
    (cc) => cc.direction === 'counterclockwise'
  )
  const offClockwise = offImports.find((cc) => cc.direction === 'clockwise')
  const offCounter = offImports.find(
    (cc) => cc.direction === 'counterclockwise'
  )

  return {
    id: uuidv4(),
    points: points as BackgammonBoard['points'],
    bar: {
      clockwise: {
        id: barClockwiseId,
        kind: 'bar',
        position: 'bar',
        direction: 'clockwise',
        checkers: barClockwise
          ? createCheckers(
              barClockwise.checkers.qty,
              barClockwise.checkers.color,
              barClockwiseId
            )
          : [],
      },
      counterclockwise: {
        id: barCounterId,
        kind: 'bar',
        position: 'bar',
        direction: 'counterclockwise',
        checkers: barCounter
          ? createCheckers(
              barCounter.checkers.qty,
              barCounter.checkers.color,
              barCounterId
            )
          : [],
      },
    },
    off: {
      clockwise: {
        id: offClockwiseId,
        kind: 'off',
        position: 'off',
        direction: 'clockwise',
        checkers: offClockwise
          ? createCheckers(
              offClockwise.checkers.qty,
              offClockwise.checkers.color,
              offClockwiseId
            )
          : [],
      },
      counterclockwise: {
        id: offCounterId,
        kind: 'off',
        position: 'off',
        direction: 'counterclockwise',
        checkers: offCounter
          ? createCheckers(
              offCounter.checkers.qty,
              offCounter.checkers.color,
              offCounterId
            )
          : [],
      },
    },
  }
}

/**
 * Convenience: position ID + on-roll context → fully materialized
 * BackgammonBoard. Composes decodePositionId + importFromDecoded +
 * buildBoardFromImport.
 */
export function boardFromPositionId(
  positionId: string,
  onRoll: OnRollContext
): BackgammonBoard {
  const decoded = decodePositionId(positionId)
  const imports = importFromDecoded(decoded, onRoll)
  return buildBoardFromImport(imports)
}

// ─── pip count ──────────────────────────────────────────────────────

const toPips = (value: number): BackgammonPlayerInactive['pipCount'] =>
  value as BackgammonPlayerInactive['pipCount']

/**
 * Compute a player's pip count in their own direction of travel.
 * Bar checkers contribute 25 pips each.
 */
export function calculatePipCount(
  board: BackgammonBoard,
  color: BackgammonColor,
  direction: BackgammonMoveDirection
): BackgammonPlayerInactive['pipCount'] {
  let total = 0

  board.points.forEach((point) => {
    const count = point.checkers.filter((c) => c.color === color).length
    if (count > 0) {
      total += count * point.position[direction]
    }
  })

  const barCount = board.bar[direction].checkers.filter(
    (c) => c.color === color
  ).length
  total += barCount * 25

  return toPips(total)
}
