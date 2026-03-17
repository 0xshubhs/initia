// House edge percentages per game
export const HOUSE_EDGE = {
  coinflip: 2, // 2% house edge => 1.96x payout
  diceroll: 1, // 1% house edge
  crash: 3,    // 3% house edge
} as const

// Payout multipliers
export const COINFLIP_PAYOUT = 1.96
export const DICE_MIN_TARGET = 2
export const DICE_MAX_TARGET = 98
export const CRASH_MAX_MULTIPLIER = 1000

// Bet limits (in wei-equivalent)
export const MIN_BET = BigInt('100000000000000000')   // 0.1 INIT
export const MAX_BET = BigInt('100000000000000000000') // 100 INIT
export const DEFAULT_BET = BigInt('1000000000000000000') // 1 INIT

// Session key defaults
export const SESSION_DURATION = 24 * 60 * 60 // 24 hours in seconds
export const SESSION_MAX_AMOUNT = BigInt('10000000000000000000') // 10 INIT

// Animation durations
export const COIN_FLIP_DURATION = 2000 // ms
export const DICE_ROLL_DURATION = 1500 // ms
export const CRASH_TICK_INTERVAL = 50 // ms

// UI
export const RECENT_RESULTS_COUNT = 10
export const LEADERBOARD_PAGE_SIZE = 25
