/**
 * Format a bigint token amount to human-readable string
 * @param amount - Amount in smallest unit (wei)
 * @param decimals - Token decimals (default 18)
 * @param displayDecimals - How many decimals to show (default 4)
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number = 18,
  displayDecimals: number = 4,
): string {
  const isNegative = amount < BigInt(0)
  const absAmount = isNegative ? -amount : amount
  const divisor = BigInt(10 ** decimals)
  const wholePart = absAmount / divisor
  const fractionalPart = absAmount % divisor

  const fractionalStr = fractionalPart
    .toString()
    .padStart(decimals, '0')
    .slice(0, displayDecimals)

  // Remove trailing zeros
  const trimmedFractional = fractionalStr.replace(/0+$/, '')
  const prefix = isNegative ? '-' : ''

  if (trimmedFractional === '') {
    return `${prefix}${wholePart.toString()}`
  }

  return `${prefix}${wholePart}.${trimmedFractional}`
}

/**
 * Parse a human-readable amount to bigint
 */
export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  const parts = amount.split('.')
  const whole = parts[0] || '0'
  const fraction = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fraction)
}

/**
 * Format an address for display (0x1234...5678)
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Format a timestamp to relative time
 */
export function timeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp * 1000

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

/**
 * Calculate dice roll payout based on target (roll under)
 * House edge is 1%
 */
export function calculateDicePayout(target: number): number {
  if (target < 2 || target > 98) return 0
  return parseFloat(((99 / target) * 0.99).toFixed(4))
}

/**
 * Calculate dice roll win probability
 */
export function calculateDiceWinChance(target: number): number {
  return target
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format large numbers with K/M/B suffixes
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toFixed(2)
}

/**
 * Generate a random hex string (for mock tx hashes)
 */
export function randomHex(length: number = 64): string {
  const chars = '0123456789abcdef'
  let result = '0x'
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Sleep for a given number of milliseconds (for animations)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate a crash point using a provably fair algorithm (mock)
 */
export function generateCrashPoint(): number {
  const e = Math.random()
  if (e < 0.03) return 1.0 // 3% instant crash
  return parseFloat(Math.max(1, (0.97 / (1 - e))).toFixed(2))
}

/**
 * Combine CSS class names, filtering out falsy values
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
