'use client'

import { useState, useCallback } from 'react'
import { useAccount, usePublicClient, useWriteContract, useReadContract } from 'wagmi'
import type { VaultStats, TxState } from '@/types'
import {
  CONTRACT_ADDRESSES,
  TOKEN_ADDRESS,
  ERC20_ABI,
  HOUSE_VAULT_ABI,
} from '@/config/contracts'

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

  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const vaultAddress = CONTRACT_ADDRESSES.houseVault

  // On-chain reads
  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: vaultAddress,
    abi: HOUSE_VAULT_ABI,
    functionName: 'totalAssets',
  })

  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: vaultAddress,
    abi: HOUSE_VAULT_ABI,
    functionName: 'totalSupply',
  })

  const { data: totalPayoutsVal, refetch: refetchTotalPayouts } = useReadContract({
    address: vaultAddress,
    abi: HOUSE_VAULT_ABI,
    functionName: 'totalPayouts',
  })

  const { data: totalBetsReceivedVal, refetch: refetchTotalBets } = useReadContract({
    address: vaultAddress,
    abi: HOUSE_VAULT_ABI,
    functionName: 'totalBetsReceived',
  })

  const { data: userShares, refetch: refetchUserShares } = useReadContract({
    address: vaultAddress,
    abi: HOUSE_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: userShareValue, refetch: refetchUserShareValue } = useReadContract({
    address: vaultAddress,
    abi: HOUSE_VAULT_ABI,
    functionName: 'previewRedeem',
    args: userShares ? [userShares as bigint] : undefined,
    query: { enabled: !!userShares && (userShares as bigint) > BigInt(0) },
  })

  // Compute stats from on-chain data
  const tvl = (totalAssets as bigint) ?? BigInt(0)
  const supply = (totalSupply as bigint) ?? BigInt(0)
  const payouts = (totalPayoutsVal as bigint) ?? BigInt(0)
  const betsReceived = (totalBetsReceivedVal as bigint) ?? BigInt(0)
  const shares = (userShares as bigint) ?? BigInt(0)
  const shareValue = (userShareValue as bigint) ?? BigInt(0)

  const netProfit = betsReceived > payouts ? betsReceived - payouts : BigInt(0)
  const userShare = supply > BigInt(0)
    ? Number((shares * BigInt(10000)) / supply) / 100
    : 0

  const stats: VaultStats = {
    tvl,
    totalDepositors: 0, // Not available from contract; could be tracked off-chain
    apy: 0, // Cannot reliably compute from on-chain data alone
    totalProfit: betsReceived,
    totalLoss: payouts,
    netProfit,
    userDeposit: shareValue,
    userShare,
    pendingRewards: BigInt(0), // ERC4626 has no pending rewards concept
  }

  const deposit = useCallback(async (amount: bigint) => {
    if (amount <= BigInt(0) || !address || !publicClient) return

    try {
      setTxState('confirming')

      // Check ERC20 allowance and approve if needed
      const currentAllowance = await publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, vaultAddress],
      }) as bigint

      if (currentAllowance < amount) {
        const approveHash = await writeContractAsync({
          address: TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [vaultAddress, amount],
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      setTxState('pending')

      // Deposit: (assets, receiver)
      const depositHash = await writeContractAsync({
        address: vaultAddress,
        abi: HOUSE_VAULT_ABI,
        functionName: 'deposit',
        args: [amount, address],
      })

      setTxHash(depositHash)
      await publicClient.waitForTransactionReceipt({ hash: depositHash })

      setTxState('success')

      // Refresh all stats
      refreshStats()

      // Reset tx state after a delay
      setTimeout(() => {
        setTxState('idle')
        setTxHash(null)
      }, 3000)
    } catch (error) {
      console.error('[useHouseVault] deposit failed:', error)
      setTxState('error')
      setTimeout(() => {
        setTxState('idle')
        setTxHash(null)
      }, 3000)
    }
  }, [address, publicClient, writeContractAsync, vaultAddress])

  const withdraw = useCallback(async (shares: bigint) => {
    if (shares <= BigInt(0) || !address || !publicClient) return

    try {
      setTxState('confirming')
      setTxState('pending')

      // Redeem: (shares, receiver, owner)
      const redeemHash = await writeContractAsync({
        address: vaultAddress,
        abi: HOUSE_VAULT_ABI,
        functionName: 'redeem',
        args: [shares, address, address],
      })

      setTxHash(redeemHash)
      await publicClient.waitForTransactionReceipt({ hash: redeemHash })

      setTxState('success')

      // Refresh all stats
      refreshStats()

      setTimeout(() => {
        setTxState('idle')
        setTxHash(null)
      }, 3000)
    } catch (error) {
      console.error('[useHouseVault] withdraw failed:', error)
      setTxState('error')
      setTimeout(() => {
        setTxState('idle')
        setTxHash(null)
      }, 3000)
    }
  }, [address, publicClient, writeContractAsync, vaultAddress])

  const refreshStats = useCallback(() => {
    refetchTotalAssets()
    refetchTotalSupply()
    refetchTotalPayouts()
    refetchTotalBets()
    refetchUserShares()
    refetchUserShareValue()
  }, [refetchTotalAssets, refetchTotalSupply, refetchTotalPayouts, refetchTotalBets, refetchUserShares, refetchUserShareValue])

  return { stats, txState, txHash, deposit, withdraw, refreshStats }
}
