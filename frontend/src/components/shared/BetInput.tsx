'use client'

import { useState, useCallback, useEffect } from 'react'
import { formatTokenAmount, parseTokenAmount } from '@/lib/utils'
import { MIN_BET, MAX_BET } from '@/lib/constants'

interface BetInputProps {
  value: bigint
  onChange: (value: bigint) => void
  disabled?: boolean
  maxBalance?: bigint
}

export default function BetInput({ value, onChange, disabled = false, maxBalance }: BetInputProps) {
  const [displayValue, setDisplayValue] = useState(formatTokenAmount(value))

  useEffect(() => {
    setDisplayValue(formatTokenAmount(value))
  }, [value])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (!/^\d*\.?\d*$/.test(raw)) return
    setDisplayValue(raw)

    if (raw === '' || raw === '.') {
      onChange(BigInt(0))
      return
    }

    try {
      const parsed = parseTokenAmount(raw)
      onChange(parsed)
    } catch {
      // Invalid input, don't update
    }
  }, [onChange])

  const handleBlur = useCallback(() => {
    let clamped = value
    if (clamped <= BigInt(0)) clamped = MIN_BET
    if (clamped < MIN_BET) clamped = MIN_BET
    if (clamped > MAX_BET) clamped = MAX_BET
    if (maxBalance && clamped > maxBalance) clamped = maxBalance
    onChange(clamped)
    setDisplayValue(formatTokenAmount(clamped))
  }, [value, onChange, maxBalance])

  const handleMultiplier = useCallback((mult: number) => {
    if (mult === -1 && maxBalance) {
      const max = maxBalance > MAX_BET ? MAX_BET : maxBalance
      onChange(max)
      return
    }
    const newValue = value * BigInt(mult)
    const clamped = newValue > MAX_BET ? MAX_BET : newValue < MIN_BET ? MIN_BET : newValue
    onChange(clamped)
  }, [value, onChange, maxBalance])

  const handleHalf = useCallback(() => {
    const halfValue = value / BigInt(2)
    const clamped = halfValue < MIN_BET ? MIN_BET : halfValue
    onChange(clamped)
  }, [value, onChange])

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-wider text-text-secondary">
        Bet Amount (INIT)
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          aria-label="Bet amount in INIT"
          className="w-full bg-bg border border-border rounded-lg px-4 py-3 font-mono text-lg
                     text-text placeholder-text-dim
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
          placeholder="0.0"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary text-sm">
          INIT
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleHalf}
          disabled={disabled}
          aria-label="Halve bet amount"
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md
                     bg-surface border border-border text-text-secondary
                     hover:border-amber-dim hover:text-amber
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
        >
          1/2
        </button>
        <button
          onClick={() => handleMultiplier(2)}
          disabled={disabled}
          aria-label="Double bet amount"
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md
                     bg-surface border border-border text-text-secondary
                     hover:border-amber-dim hover:text-amber
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
        >
          2x
        </button>
        <button
          onClick={() => handleMultiplier(5)}
          disabled={disabled}
          aria-label="Multiply bet by 5"
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md
                     bg-surface border border-border text-text-secondary
                     hover:border-amber-dim hover:text-amber
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
        >
          5x
        </button>
        <button
          onClick={() => handleMultiplier(-1)}
          disabled={disabled}
          aria-label="Set bet to maximum"
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md
                     bg-surface border border-border text-amber-dim
                     hover:border-amber hover:text-amber
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
        >
          MAX
        </button>
      </div>
    </div>
  )
}
