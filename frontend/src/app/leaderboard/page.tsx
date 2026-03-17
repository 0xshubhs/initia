'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { formatTokenAmount, shortenAddress, cn } from '@/lib/utils'
import type { LeaderboardPeriod } from '@/types'

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  all: 'All Time',
  weekly: 'This Week',
  daily: 'Today',
}

export default function LeaderboardPage() {
  const { entries, period, setPeriod, isLoading, refresh } = useLeaderboard()

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono text-text mb-2">
            <span className="text-amber crt-glow">$</span> Leaderboard
          </h1>
          <p className="text-sm text-text-secondary font-mono">Top players by profit & loss. Climb the ranks.</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-text-secondary hover:border-amber-dim hover:text-amber transition-all duration-200 text-sm font-mono self-start">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="flex rounded-lg bg-surface border border-border overflow-hidden w-fit">
        {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={cn('px-5 py-2.5 text-sm font-mono font-semibold transition-all duration-200', period === p ? 'bg-amber/10 text-amber border-b-2 border-amber' : 'text-text-secondary hover:text-text')}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="card-glow bg-surface rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-border text-xs font-mono text-text-secondary uppercase tracking-wider">
          <div className="col-span-1">#</div>
          <div className="col-span-3">Player</div>
          <div className="col-span-2 text-right hidden sm:block">Wagered</div>
          <div className="col-span-2 text-right hidden md:block">Won</div>
          <div className="col-span-2 text-right">P&L</div>
          <div className="col-span-1 text-right hidden lg:block">Games</div>
          <div className="col-span-1 text-right hidden lg:block">Win %</div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center">
            <motion.p animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-amber font-mono text-sm">Loading leaderboard...</motion.p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={period} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {entries.map((entry, i) => {
                const isPositive = entry.pnl >= BigInt(0)
                const isTop3 = i < 3
                return (
                  <motion.div key={entry.address} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className={cn('grid grid-cols-12 gap-2 px-5 py-3 text-sm font-mono border-b border-border/50 hover:bg-surface-hover transition-colors duration-150', isTop3 && 'bg-amber/3')}>
                    <div className="col-span-1 flex items-center">
                      <span className={cn('font-bold', i === 0 && 'text-amber crt-glow', i === 1 && 'text-text', i === 2 && 'text-amber-dim', i > 2 && 'text-text-secondary')}>{entry.rank}</span>
                    </div>
                    <div className="col-span-3 flex items-center gap-2 truncate">
                      {entry.username ? <span className="text-amber truncate">{entry.username}</span> : <span className="text-text-secondary truncate">{shortenAddress(entry.address)}</span>}
                    </div>
                    <div className="col-span-2 text-right text-text-secondary hidden sm:flex items-center justify-end">{formatTokenAmount(entry.totalWagered, 18, 2)}</div>
                    <div className="col-span-2 text-right text-text-secondary hidden md:flex items-center justify-end">{formatTokenAmount(entry.totalWon, 18, 2)}</div>
                    <div className={cn('col-span-2 text-right font-bold flex items-center justify-end', isPositive ? 'text-green' : 'text-red')}>
                      {isPositive ? '+' : ''}{formatTokenAmount(entry.pnl, 18, 2)}
                    </div>
                    <div className="col-span-1 text-right text-text-secondary hidden lg:flex items-center justify-end">{entry.gamesPlayed}</div>
                    <div className="col-span-1 text-right hidden lg:flex items-center justify-end">
                      <span className={cn(entry.winRate >= 50 ? 'text-green' : 'text-text-secondary')}>{entry.winRate.toFixed(1)}%</span>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <div className="card-glow bg-surface rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center">
              <span className="text-xs text-amber font-bold font-mono">?</span>
            </div>
            <div>
              <p className="text-sm text-text font-mono">Your Position</p>
              <p className="text-xs text-text-secondary">Connect wallet to see your rank</p>
            </div>
          </div>
          <span className="text-xs text-text-dim font-mono">--</span>
        </div>
      </div>
    </motion.div>
  )
}
