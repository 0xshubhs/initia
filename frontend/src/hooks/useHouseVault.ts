'use client'

import { useState, useCallback, useEffect } from 'react'
import type { VaultStats, TxState } from '@/types'
import { randomHex, sleep } from '@/lib/utils'

interface UseHouseVaultReturn {
  stats: VaultStats
  txState: TxState
  txHash: string | null
  deposit: (amount: bigint) => Promise<void>
  withdraw: (shares: bigint) => Promise<void>
  refreshStats: () => void
}

export function useHouseVault(): UseHouseVaultReturn {
  const [txState, setTxState] = useState<TxState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)

  const [stats, setStats] = useState<VaultStats>({
    tvl: BigInt('1250000000000000000000'),
    totalDepositors: 47,
    apy: 12.5,
    totalProfit: BigInt('156000000000000000000'),
    totalLoss: BigInt('98000000000000000000'),
    netProfit: BigInt('58000000000000000000'),
    userDeposit: BigInt(0),
    userShare: 0,
    pendingRewards: BigInt(0),
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => {
        const tvlDelta = BigInt(Math.floor(Math.random() * 10 - 3)) * BigInt('1000000000000000000')
        const newTvl = prev.tvl + tvlDelta
        return {
          ...prev,
          tvl: newTvl > BigInt(0) ? newTvl : prev.tvl,
          apy: Math.max(0, prev.apy + (Math.random() - 0.5) * 0.1),
        }
      })
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const deposit = useCallback(async (amount: bigint) => {
    setTxState('confirming')
    await sleep(500)
    setTxState('pending')
    setTxHash(randomHex(64))
    await sleep(1500)
    setStats(prev => ({
      ...prev,
      tvl: prev.tvl + amount,
      userDeposit: prev.userDeposit + amount,
      totalDepositors: prev.totalDepositors + 1,
      userShare: Number(((prev.userDeposit + amount) * BigInt(10000)) / (prev.tvl + amount)) / 100,
    }))
    setTxState('success')
    await sleep(2000)
    setTxState('idle')
    setTxHash(null)
  }, [])

  const withdraw = useCallback(async (shares: bigint) => {
    setTxState('confirming')
    await sleep(500)
    setTxState('pending')
    setTxHash(randomHex(64))
    await sleep(1500)
    setStats(prev => {
      const withdrawAmount = (shares * prev.tvl) / (prev.tvl > BigInt(0) ? prev.tvl : BigInt(1))
      const newUserDeposit = prev.userDeposit > withdrawAmount ? prev.userDeposit - withdrawAmount : BigInt(0)
      const newTvl = prev.tvl > withdrawAmount ? prev.tvl - withdrawAmount : BigInt(0)
      return {
        ...prev,
        tvl: newTvl,
        userDeposit: newUserDeposit,
        userShare: newTvl > BigInt(0) ? Number((newUserDeposit * BigInt(10000)) / newTvl) / 100 : 0,
      }
    })
    setTxState('success')
    await sleep(2000)
    setTxState('idle')
    setTxHash(null)
  }, [])

  const refreshStats = useCallback(() => {}, [])

  return { stats, txState, txHash, deposit, withdraw, refreshStats }
}
