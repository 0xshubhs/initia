'use client'

import { useState, useCallback, useEffect } from 'react'
import { parseEventLogs } from 'viem'
import { useAccount, usePublicClient, useWriteContract, useReadContract } from 'wagmi'
import type { SessionKeyInfo } from '@/types'
import { SESSION_DURATION, SESSION_MAX_AMOUNT } from '@/lib/constants'
import { CONTRACT_ADDRESSES, SESSION_MANAGER_ABI } from '@/config/contracts'

interface UseSessionKeyReturn {
  sessionKey: SessionKeyInfo | null
  isCreating: boolean
  isRevoking: boolean
  isActive: boolean
  createSession: (duration?: number, maxAmount?: bigint) => Promise<void>
  revokeSession: () => Promise<void>
  timeRemaining: number | null
}

export function useSessionKey(): UseSessionKeyReturn {
  const [sessionKey, setSessionKey] = useState<SessionKeyInfo | null>(null)
  const [sessionId, setSessionId] = useState<bigint | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  // Check session validity on-chain
  const { data: isSessionValidOnChain } = useReadContract({
    address: CONTRACT_ADDRESSES.sessionManager,
    abi: SESSION_MANAGER_ABI,
    functionName: 'isSessionValid',
    args: sessionId !== null ? [sessionId] : undefined,
    query: { enabled: sessionId !== null, refetchInterval: 30_000 },
  })

  const isActive = sessionKey !== null
    && sessionKey.isActive
    && sessionKey.expiresAt > Date.now() / 1000
    && (isSessionValidOnChain as boolean ?? false)

  // Update timeRemaining every 30 seconds
  useEffect(() => {
    if (!sessionKey || !sessionKey.isActive) {
      setTimeRemaining(null)
      return
    }

    const update = () => {
      const remaining = Math.max(0, sessionKey.expiresAt - Math.floor(Date.now() / 1000))
      setTimeRemaining(remaining)
      if (remaining <= 0) {
        setSessionKey(prev => prev ? { ...prev, isActive: false } : null)
      }
    }

    update()
    const interval = setInterval(update, 30_000)
    return () => clearInterval(interval)
  }, [sessionKey])

  const createSession = useCallback(async (
    duration: number = SESSION_DURATION,
    maxAmount: bigint = SESSION_MAX_AMOUNT,
  ) => {
    if (!address || !publicClient) return

    setIsCreating(true)
    try {
      // Generate a random delegate address (ephemeral key for session)
      const delegateBytes = new Uint8Array(20)
      crypto.getRandomValues(delegateBytes)
      const delegateAddress = `0x${Array.from(delegateBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`

      const now = Math.floor(Date.now() / 1000)
      const expiresAt = BigInt(now + duration)
      const spendingLimit = maxAmount

      const allowedGames: `0x${string}`[] = [
        CONTRACT_ADDRESSES.coinFlip,
        CONTRACT_ADDRESSES.diceRoll,
        CONTRACT_ADDRESSES.crashGame,
      ]

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.sessionManager,
        abi: SESSION_MANAGER_ABI,
        functionName: 'createSession',
        args: [delegateAddress, maxAmount, spendingLimit, expiresAt, allowedGames],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      // Extract sessionId from the SessionCreated event
      const sessionEvents = parseEventLogs({
        abi: SESSION_MANAGER_ABI,
        logs: receipt.logs,
        eventName: 'SessionCreated',
      })

      let newSessionId: bigint | null = null
      if (sessionEvents.length > 0) {
        newSessionId = sessionEvents[0].args.sessionId
        setSessionId(newSessionId)
      }

      setSessionKey({
        publicKey: delegateAddress,
        expiresAt: Number(expiresAt),
        maxAmount,
        allowedContracts: allowedGames,
        isActive: true,
      })
    } catch (error) {
      console.error('[useSessionKey] createSession failed:', error)
    } finally {
      setIsCreating(false)
    }
  }, [address, publicClient, writeContractAsync])

  const revokeSession = useCallback(async () => {
    if (!publicClient || sessionId === null) return

    setIsRevoking(true)
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.sessionManager,
        abi: SESSION_MANAGER_ABI,
        functionName: 'revokeSession',
        args: [sessionId],
      })

      await publicClient.waitForTransactionReceipt({ hash })

      setSessionKey(null)
      setSessionId(null)
    } catch (error) {
      console.error('[useSessionKey] revokeSession failed:', error)
    } finally {
      setIsRevoking(false)
    }
  }, [publicClient, writeContractAsync, sessionId])

  return { sessionKey, isCreating, isRevoking, isActive, createSession, revokeSession, timeRemaining }
}
