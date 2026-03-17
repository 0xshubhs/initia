'use client'

import { useState, useCallback, useEffect } from 'react'
import type { LeaderboardEntry, LeaderboardPeriod } from '@/types'

const MOCK_NAMES = [
  'whale.init', 'degen.init', 'lucky7.init', 'moonshot.init',
  'diamondhands.init', 'flipmaster.init', 'rollking.init', 'crash_lord.init',
  'init_guru.init', 'based.init', 'nfa.init', 'gm.init',
  'wagmi.init', 'chad.init', 'alpha.init', 'sigma.init',
  'zero.init', 'maxi.init', 'anon.init', 'builder.init',
]

function generateMockEntry(rank: number, period: LeaderboardPeriod): LeaderboardEntry {
  const multiplier = period === 'all' ? 100 : period === 'weekly' ? 10 : 1
  const baseWagered = (Math.random() * 500 + 50) * multiplier
  const pnl = (Math.random() - 0.45) * baseWagered * 0.3
  const totalWon = pnl > 0 ? baseWagered * 0.5 + pnl : baseWagered * 0.4
  const totalLost = baseWagered - totalWon

  return {
    rank,
    address: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    username: Math.random() > 0.2 ? MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)] : null,
    totalWagered: BigInt(Math.floor(baseWagered * 1e18)),
    totalWon: BigInt(Math.floor(totalWon * 1e18)),
    totalLost: BigInt(Math.floor(totalLost * 1e18)),
    pnl: BigInt(Math.floor(pnl * 1e18)),
    gamesPlayed: Math.floor(Math.random() * 500 * multiplier) + 10,
    winRate: Math.random() * 30 + 35,
  }
}

function generateLeaderboard(period: LeaderboardPeriod): LeaderboardEntry[] {
  return Array.from({ length: 25 }, (_, i) => generateMockEntry(i + 1, period))
    .sort((a, b) => Number(b.pnl - a.pnl))
    .map((entry, i) => ({ ...entry, rank: i + 1 }))
}

interface UseLeaderboardReturn {
  entries: LeaderboardEntry[]
  period: LeaderboardPeriod
  setPeriod: (period: LeaderboardPeriod) => void
  isLoading: boolean
  refresh: () => void
}

export function useLeaderboard(): UseLeaderboardReturn {
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback((p: LeaderboardPeriod) => {
    setIsLoading(true)
    setTimeout(() => {
      setEntries(generateLeaderboard(p))
      setIsLoading(false)
    }, 600)
  }, [])

  useEffect(() => {
    loadData(period)
  }, [period, loadData])

  const refresh = useCallback(() => {
    loadData(period)
  }, [period, loadData])

  const handleSetPeriod = useCallback((newPeriod: LeaderboardPeriod) => {
    setPeriod(newPeriod)
  }, [])

  return { entries, period, setPeriod: handleSetPeriod, isLoading, refresh }
}
