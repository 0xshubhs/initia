// ============================================
// Game Types
// ============================================

export type GameType = 'coinflip' | 'diceroll' | 'crash'

export type GameStatus = 'idle' | 'betting' | 'pending' | 'revealing' | 'won' | 'lost'

export interface GameResult {
  id: string
  game: GameType
  player: string
  betAmount: bigint
  payout: bigint
  outcome: string
  won: boolean
  timestamp: number
  txHash: string
}

export interface CoinFlipResult extends GameResult {
  game: 'coinflip'
  choice: 'heads' | 'tails'
  result: 'heads' | 'tails'
}

export interface DiceRollResult extends GameResult {
  game: 'diceroll'
  target: number
  rollUnder: boolean
  rolled: number
}

export interface CrashResult extends GameResult {
  game: 'crash'
  cashOutAt: number
  crashPoint: number
}

// ============================================
// Vault Types
// ============================================

export interface VaultStats {
  tvl: bigint
  totalDepositors: number
  apy: number
  totalProfit: bigint
  totalLoss: bigint
  netProfit: bigint
  userDeposit: bigint
  userShare: number
  pendingRewards: bigint
}

// ============================================
// Leaderboard Types
// ============================================

export type LeaderboardPeriod = 'all' | 'weekly' | 'daily'

export interface LeaderboardEntry {
  rank: number
  address: string
  username: string | null
  totalWagered: bigint
  totalWon: bigint
  totalLost: bigint
  pnl: bigint
  gamesPlayed: number
  winRate: number
}

// ============================================
// Session Key Types
// ============================================

export interface SessionKeyInfo {
  publicKey: string
  expiresAt: number
  maxAmount: bigint
  allowedContracts: string[]
  isActive: boolean
}

// ============================================
// Transaction Types
// ============================================

export type TxState = 'idle' | 'confirming' | 'pending' | 'success' | 'error'

export interface TxInfo {
  state: TxState
  hash?: string
  error?: string
}

// ============================================
// Chart Types
// ============================================

export interface CrashPoint {
  time: number
  multiplier: number
}

export interface ProfitDataPoint {
  date: string
  profit: number
  cumulative: number
}
