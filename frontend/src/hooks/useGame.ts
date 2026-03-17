'use client'

import { useState, useCallback, useRef } from 'react'
import type { GameStatus, GameResult, TxState, GameType } from '@/types'
import { randomHex, sleep } from '@/lib/utils'
import { COIN_FLIP_DURATION, DICE_ROLL_DURATION } from '@/lib/constants'

interface UseGameOptions {
  gameType: GameType
  onWin?: (result: GameResult) => void
  onLoss?: (result: GameResult) => void
}

interface UseGameReturn {
  status: GameStatus
  txState: TxState
  txHash: string | null
  lastResult: GameResult | null
  results: GameResult[]
  isPlaying: boolean
  placeBet: (params: PlaceBetParams) => Promise<GameResult>
  reset: () => void
}

interface PlaceBetParams {
  amount: bigint
  chooseHeads?: boolean
  target?: number
  rollUnder?: boolean
}

export function useGame({ gameType, onWin, onLoss }: UseGameOptions): UseGameReturn {
  const [status, setStatus] = useState<GameStatus>('idle')
  const [txState, setTxState] = useState<TxState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<GameResult | null>(null)
  const [results, setResults] = useState<GameResult[]>([])
  const resultIdCounter = useRef(0)

  const isPlaying = status === 'betting' || status === 'pending' || status === 'revealing'

  const placeBet = useCallback(async (params: PlaceBetParams): Promise<GameResult> => {
    setStatus('betting')
    setTxState('confirming')

    await sleep(400)
    setTxState('pending')

    const hash = randomHex(64)
    setTxHash(hash)
    setStatus('pending')

    const duration = gameType === 'coinflip' ? COIN_FLIP_DURATION : DICE_ROLL_DURATION
    await sleep(duration)

    setStatus('revealing')

    let won: boolean
    let outcome: string
    let payout: bigint

    switch (gameType) {
      case 'coinflip': {
        const resultIsHeads = Math.random() > 0.5
        const chooseHeads = params.chooseHeads ?? true
        won = resultIsHeads === chooseHeads
        outcome = resultIsHeads ? 'heads' : 'tails'
        payout = won ? (params.amount * BigInt(196)) / BigInt(100) : BigInt(0)
        break
      }
      case 'diceroll': {
        const target = params.target ?? 50
        const rolled = Math.floor(Math.random() * 100) + 1
        const rollUnder = params.rollUnder ?? true
        won = rollUnder ? rolled < target : rolled > target
        outcome = rolled.toString()
        const multiplier = rollUnder
          ? Math.floor((99 / target) * 99)
          : Math.floor((99 / (100 - target)) * 99)
        payout = won ? (params.amount * BigInt(multiplier)) / BigInt(100) : BigInt(0)
        break
      }
      case 'crash': {
        won = false
        outcome = '1.00'
        payout = BigInt(0)
        break
      }
      default:
        won = false
        outcome = ''
        payout = BigInt(0)
    }

    const result: GameResult = {
      id: `${gameType}-${++resultIdCounter.current}`,
      game: gameType,
      player: '0x0000000000000000000000000000000000000000',
      betAmount: params.amount,
      payout,
      outcome,
      won,
      timestamp: Math.floor(Date.now() / 1000),
      txHash: hash,
    }

    setLastResult(result)
    setResults(prev => [result, ...prev].slice(0, 50))
    setTxState('success')
    setStatus(won ? 'won' : 'lost')

    if (won) onWin?.(result)
    else onLoss?.(result)

    return result
  }, [gameType, onWin, onLoss])

  const reset = useCallback(() => {
    setStatus('idle')
    setTxState('idle')
    setTxHash(null)
  }, [])

  return { status, txState, txHash, lastResult, results, isPlaying, placeBet, reset }
}
