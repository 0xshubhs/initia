'use client'

import { useState, useCallback } from 'react'
import { useReadContract } from 'wagmi'
import type { LeaderboardEntry, LeaderboardPeriod } from '@/types'
import { CONTRACT_ADDRESSES, LEADERBOARD_ABI } from '@/config/contracts'

interface UseLeaderboardReturn {
  entries: LeaderboardEntry[]
  period: LeaderboardPeriod
  setPeriod: (period: LeaderboardPeriod) => void
  isLoading: boolean
  refresh: () => void
}

interface PlayerStats {
  totalWagered: bigint
  totalWon: bigint
  totalLost: bigint
  biggestWin: bigint
  gamesPlayed: bigint
  gamesWon: bigint
}

export function useLeaderboard(): UseLeaderboardReturn {
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')

  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.leaderboard,
    abi: LEADERBOARD_ABI,
    functionName: 'topByWagered',
    args: [BigInt(25)],
  })

  // Map the contract response to LeaderboardEntry[]
  let entries: LeaderboardEntry[] = []

  if (data) {
    const [players, stats] = data as [readonly `0x${string}`[], readonly PlayerStats[]]

    const mapped: LeaderboardEntry[] = []
    for (let index = 0; index < players.length; index++) {
      const playerAddress = players[index]
      const s = stats[index]
      if (!s || !playerAddress) continue

      const totalWon = s.totalWon
      const totalWagered = s.totalWagered
      const pnl = totalWon > totalWagered
        ? totalWon - totalWagered
        : -(totalWagered - totalWon)
      const gamesPlayed = Number(s.gamesPlayed)
      const gamesWon = Number(s.gamesWon)
      const winRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0

      mapped.push({
        rank: index + 1,
        address: playerAddress as string,
        username: null,
        totalWagered: s.totalWagered,
        totalWon: s.totalWon,
        totalLost: s.totalLost,
        pnl,
        gamesPlayed,
        winRate,
      })
    }
    entries = mapped
      .sort((a, b) => {
        if (b.totalWagered > a.totalWagered) return 1
        if (b.totalWagered < a.totalWagered) return -1
        return 0
      })
      .map((entry, i) => ({ ...entry, rank: i + 1 }))
  }

  const refresh = useCallback(() => {
    refetch()
  }, [refetch])

  const handleSetPeriod = useCallback((newPeriod: LeaderboardPeriod) => {
    // The contract only supports all-time data.
    // Period filtering is kept in the interface for future use,
    // but always displays all-time data from the contract.
    setPeriod(newPeriod)
  }, [])

  return { entries, period, setPeriod: handleSetPeriod, isLoading, refresh }
}
