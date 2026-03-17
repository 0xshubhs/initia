'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useHouseVault } from '@/hooks/useHouseVault'
import BetInput from '@/components/shared/BetInput'
import TxStatus from '@/components/shared/TxStatus'
import { DEFAULT_BET } from '@/lib/constants'
import { formatTokenAmount, cn } from '@/lib/utils'

type Tab = 'deposit' | 'withdraw'

export default function VaultDeposit() {
  const [tab, setTab] = useState<Tab>('deposit')
  const [amount, setAmount] = useState(DEFAULT_BET)
  const { stats, txState, txHash, deposit, withdraw } = useHouseVault()

  const handleAction = async () => {
    if (tab === 'deposit') {
      await deposit(amount)
    } else {
      await withdraw(amount)
    }
  }

  return (
    <div className="card-glow bg-surface rounded-xl p-6 space-y-5">
      <div className="flex rounded-lg bg-bg border border-border overflow-hidden">
        {(['deposit', 'withdraw'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-3 text-sm font-mono font-semibold uppercase tracking-wider transition-all duration-200',
              tab === t
                ? 'bg-amber/10 text-amber border-b-2 border-amber'
                : 'text-text-secondary hover:text-text',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <BetInput
        value={amount}
        onChange={setAmount}
        disabled={txState === 'pending' || txState === 'confirming'}
        maxBalance={tab === 'withdraw' ? stats.userDeposit : undefined}
      />

      {tab === 'deposit' ? (
        <div className="bg-bg rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">You will receive</span>
            <span className="text-text font-mono">{formatTokenAmount(amount)} ibINIT shares</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">Current APY</span>
            <span className="text-green font-mono">{stats.apy.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">Your share after</span>
            <span className="text-amber font-mono">
              {stats.tvl > BigInt(0)
                ? ((Number(amount) / Number(stats.tvl + amount)) * 100).toFixed(4)
                : '100.00'
              }%
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-bg rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">Your deposit</span>
            <span className="text-text font-mono">{formatTokenAmount(stats.userDeposit)} INIT</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">Your share</span>
            <span className="text-amber font-mono">{stats.userShare.toFixed(4)}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">Pending rewards</span>
            <span className="text-green font-mono">{formatTokenAmount(stats.pendingRewards)} INIT</span>
          </div>
        </div>
      )}

      <TxStatus state={txState} hash={txHash} />

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleAction}
        disabled={txState === 'pending' || txState === 'confirming' || amount === BigInt(0)}
        className={cn(
          'w-full py-4 rounded-xl font-mono text-lg font-bold transition-all duration-200',
          txState !== 'pending' && txState !== 'confirming' && amount > BigInt(0)
            ? tab === 'deposit'
              ? 'bg-amber text-bg hover:bg-amber-light btn-glow cursor-pointer'
              : 'bg-red/80 text-white hover:bg-red cursor-pointer'
            : 'bg-border text-text-dim cursor-not-allowed',
        )}
      >
        {txState === 'pending' || txState === 'confirming' ? (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            Processing...
          </motion.span>
        ) : tab === 'deposit' ? (
          'DEPOSIT TO VAULT'
        ) : (
          'WITHDRAW FROM VAULT'
        )}
      </motion.button>

      <div className="bg-amber/5 border border-amber/10 rounded-lg p-3">
        <p className="text-[10px] text-amber-dim leading-relaxed">
          Warning: Depositing into the house vault exposes you to the risk of player wins.
          When players win big, the vault balance decreases. You earn yield from the house edge
          over time, but short-term losses are possible. Only deposit what you can afford to lose.
        </p>
      </div>
    </div>
  )
}
