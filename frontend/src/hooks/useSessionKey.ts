'use client'

import { useState, useCallback } from 'react'
import type { SessionKeyInfo } from '@/types'
import { SESSION_DURATION, SESSION_MAX_AMOUNT } from '@/lib/constants'
import { randomHex, sleep } from '@/lib/utils'
import { CONTRACT_ADDRESSES } from '@/config/contracts'

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
  const [isCreating, setIsCreating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  const isActive = sessionKey !== null && sessionKey.isActive && sessionKey.expiresAt > Date.now() / 1000

  const timeRemaining = sessionKey && isActive
    ? Math.max(0, sessionKey.expiresAt - Math.floor(Date.now() / 1000))
    : null

  const createSession = useCallback(async (
    duration: number = SESSION_DURATION,
    maxAmount: bigint = SESSION_MAX_AMOUNT,
  ) => {
    setIsCreating(true)
    await sleep(1200)
    const now = Math.floor(Date.now() / 1000)
    setSessionKey({
      publicKey: randomHex(40),
      expiresAt: now + duration,
      maxAmount,
      allowedContracts: [
        CONTRACT_ADDRESSES.coinFlip,
        CONTRACT_ADDRESSES.diceRoll,
        CONTRACT_ADDRESSES.crashGame,
      ],
      isActive: true,
    })
    setIsCreating(false)
  }, [])

  const revokeSession = useCallback(async () => {
    setIsRevoking(true)
    await sleep(800)
    setSessionKey(null)
    setIsRevoking(false)
  }, [])

  return { sessionKey, isCreating, isRevoking, isActive, createSession, revokeSession, timeRemaining }
}
