'use client'

import { useState, useCallback, useRef } from 'react'
import { keccak256, encodePacked, parseEventLogs } from 'viem'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import type { GameStatus, GameResult, TxState, GameType } from '@/types'
import {
  CONTRACT_ADDRESSES,
  TOKEN_ADDRESS,
  ERC20_ABI,
  COIN_FLIP_ABI,
  DICE_ROLL_ABI,
  RANDOMNESS_ABI,
} from '@/config/contracts'

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

/** Generate a cryptographically secure random bytes32 seed */
function generatePlayerSeed(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`
}

/** Polling interval for commit status checks (ms) */
const POLL_INTERVAL = 2000
/** Maximum polling attempts before giving up */
const MAX_POLL_ATTEMPTS = 150 // 5 minutes at 2s intervals

export function useGame({ gameType, onWin, onLoss }: UseGameOptions): UseGameReturn {
  const [status, setStatus] = useState<GameStatus>('idle')
  const [txState, setTxState] = useState<TxState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<GameResult | null>(null)
  const [results, setResults] = useState<GameResult[]>([])
  const resultIdCounter = useRef(0)

  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const isPlaying = status === 'approving' || status === 'betting' || status === 'pending' || status === 'revealing'

  const placeBet = useCallback(async (params: PlaceBetParams): Promise<GameResult> => {
    if (!address || !publicClient) {
      throw new Error('Wallet not connected')
    }

    const failResult = (): GameResult => ({
      id: `${gameType}-${++resultIdCounter.current}`,
      game: gameType,
      player: address,
      betAmount: params.amount,
      payout: BigInt(0),
      outcome: '',
      won: false,
      timestamp: Math.floor(Date.now() / 1000),
      txHash: '',
    })

    try {
      // Determine the contract address for the game
      const gameContractAddress = gameType === 'coinflip'
        ? CONTRACT_ADDRESSES.coinFlip
        : CONTRACT_ADDRESSES.diceRoll

      // Step 1: Generate player seed and commit hash
      const playerSeed = generatePlayerSeed()
      const playerCommitHash = keccak256(encodePacked(['bytes32'], [playerSeed]))

      // Step 2: Check ERC20 allowance and approve if needed
      setStatus('approving')
      setTxState('confirming')

      const currentAllowance = await publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, gameContractAddress],
      }) as bigint

      if (currentAllowance < params.amount) {
        const approveHash = await writeContractAsync({
          address: TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [gameContractAddress, params.amount],
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      // Step 3: Place the bet
      setStatus('betting')
      setTxState('pending')

      let betPlacedHash: `0x${string}`

      if (gameType === 'coinflip') {
        // choice: 0 = Heads, 1 = Tails
        const choice = params.chooseHeads === false ? 1 : 0
        betPlacedHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.coinFlip,
          abi: COIN_FLIP_ABI,
          functionName: 'placeBet',
          args: [params.amount, choice, playerCommitHash],
        })
      } else {
        // DiceRoll: chosenNumber is "roll under" value (2-100)
        // If rollUnder=false (Roll Over mode), convert: chosenNumber = 101 - target
        const target = params.target ?? 50
        const rollUnder = params.rollUnder ?? true
        const chosenNumber = rollUnder ? BigInt(target) : BigInt(101 - target)

        betPlacedHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.diceRoll,
          abi: DICE_ROLL_ABI,
          functionName: 'placeBet',
          args: [params.amount, chosenNumber, playerCommitHash],
        })
      }

      setTxHash(betPlacedHash)

      // Step 4: Wait for receipt and extract betId + commitId from BetPlaced event
      const betReceipt = await publicClient.waitForTransactionReceipt({ hash: betPlacedHash })

      let betId: bigint
      let commitId: bigint

      if (gameType === 'coinflip') {
        const betEvents = parseEventLogs({
          abi: COIN_FLIP_ABI,
          logs: betReceipt.logs,
          eventName: 'BetPlaced',
        })
        if (betEvents.length === 0) throw new Error('BetPlaced event not found in receipt')
        betId = betEvents[0].args.betId
        commitId = betEvents[0].args.commitId
      } else {
        const betEvents = parseEventLogs({
          abi: DICE_ROLL_ABI,
          logs: betReceipt.logs,
          eventName: 'BetPlaced',
        })
        if (betEvents.length === 0) throw new Error('BetPlaced event not found in receipt')
        betId = betEvents[0].args.betId
        commitId = betEvents[0].args.commitId
      }

      // Step 5: Poll RandomnessProvider for commit status (wait for house reveal)
      setStatus('pending')
      setTxState('pending')

      let revealed = false
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        const commitStatus = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.randomness,
          abi: RANDOMNESS_ABI,
          functionName: 'getCommitStatus',
          args: [commitId],
        }) as number

        if (commitStatus === 2) {
          // Revealed
          revealed = true
          break
        }

        if (commitStatus === 3) {
          // TimedOut - can claim refund
          throw new Error('House reveal timed out. You can claim a refund.')
        }

        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
      }

      if (!revealed) {
        throw new Error('Timed out waiting for house reveal')
      }

      // Step 6: Resolve the bet with the player seed
      setStatus('revealing')
      setTxState('pending')

      let resolveHash: `0x${string}`

      if (gameType === 'coinflip') {
        resolveHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.coinFlip,
          abi: COIN_FLIP_ABI,
          functionName: 'resolveBet',
          args: [betId, playerSeed],
        })
      } else {
        resolveHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.diceRoll,
          abi: DICE_ROLL_ABI,
          functionName: 'resolveBet',
          args: [betId, playerSeed],
        })
      }

      setTxHash(resolveHash)
      const resolveReceipt = await publicClient.waitForTransactionReceipt({ hash: resolveHash })

      // Step 7: Parse BetResolved event for the outcome
      let won: boolean
      let payout: bigint
      let outcome: string

      if (gameType === 'coinflip') {
        const resolvedEvents = parseEventLogs({
          abi: COIN_FLIP_ABI,
          logs: resolveReceipt.logs,
          eventName: 'BetResolved',
        })
        if (resolvedEvents.length === 0) throw new Error('BetResolved event not found')
        const event = resolvedEvents[0]
        won = event.args.won
        payout = event.args.payout
        // result: 0 = Heads, 1 = Tails
        outcome = event.args.result === 0 ? 'heads' : 'tails'
      } else {
        const resolvedEvents = parseEventLogs({
          abi: DICE_ROLL_ABI,
          logs: resolveReceipt.logs,
          eventName: 'BetResolved',
        })
        if (resolvedEvents.length === 0) throw new Error('BetResolved event not found')
        const event = resolvedEvents[0]
        won = event.args.won
        payout = event.args.payout
        outcome = event.args.rolledNumber.toString()
      }

      // Step 8: Build the result
      const result: GameResult = {
        id: `${gameType}-${++resultIdCounter.current}`,
        game: gameType,
        player: address,
        betAmount: params.amount,
        payout,
        outcome,
        won,
        timestamp: Math.floor(Date.now() / 1000),
        txHash: resolveHash,
      }

      setLastResult(result)
      setResults(prev => [result, ...prev].slice(0, 50))
      setTxState('success')
      setStatus(won ? 'won' : 'lost')

      if (won) onWin?.(result)
      else onLoss?.(result)

      return result
    } catch (error) {
      setTxState('error')
      setStatus('idle')
      console.error(`[useGame] ${gameType} bet failed:`, error)
      return failResult()
    }
  }, [gameType, address, publicClient, writeContractAsync, onWin, onLoss])

  const reset = useCallback(() => {
    setStatus('idle')
    setTxState('idle')
    setTxHash(null)
  }, [])

  return { status, txState, txHash, lastResult, results, isPlaying, placeBet, reset }
}
