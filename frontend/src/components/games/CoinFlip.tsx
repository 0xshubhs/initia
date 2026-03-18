'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useBalance } from 'wagmi'
import { useGame } from '@/hooks/useGame'
import BetInput from '@/components/shared/BetInput'
import GameResult from '@/components/shared/GameResult'
import TxStatus from '@/components/shared/TxStatus'
import SessionKeyManager from '@/components/wallet/SessionKeyManager'
import { DEFAULT_BET } from '@/lib/constants'
import { formatTokenAmount, cn } from '@/lib/utils'

export default function CoinFlip() {
  const [betAmount, setBetAmount] = useState(DEFAULT_BET)
  const [selectedSide, setSelectedSide] = useState<'heads' | 'tails' | null>(null)
  const [coinFlipping, setCoinFlipping] = useState(false)
  const [coinResult, setCoinResult] = useState<'heads' | 'tails' | null>(null)

  const { address, isConnected } = useAccount()
  const { data: balanceData } = useBalance({ address })

  const walletBalance = balanceData?.value ?? BigInt(0)

  const { status, txState, txHash, lastResult, results, isPlaying, placeBet, reset } = useGame({
    gameType: 'coinflip',
  })

  const handleFlip = useCallback(async () => {
    if (!selectedSide || isPlaying) return

    setCoinFlipping(true)
    setCoinResult(null)

    try {
      const result = await placeBet({
        amount: betAmount,
        chooseHeads: selectedSide === 'heads',
      })

      if (result.outcome === 'heads' || result.outcome === 'tails') {
        setCoinResult(result.outcome)
      }
    } catch {
      // Error is handled by the useGame hook via txState
    } finally {
      setCoinFlipping(false)
    }
  }, [selectedSide, isPlaying, betAmount, placeBet])

  const isApproving = status === 'approving'
  const potentialPayout = (betAmount * BigInt(196)) / BigInt(100)
  const recentDots = results.slice(0, 10)

  return (
    <div className="space-y-6">
      <GameResult
        status={status}
        won={lastResult?.won ?? false}
        payout={lastResult?.payout ?? BigInt(0)}
        betAmount={lastResult?.betAmount ?? BigInt(0)}
        outcome={lastResult?.outcome}
        onDismiss={reset}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-glow bg-surface rounded-xl p-8 flex flex-col items-center justify-center min-h-[320px]">
            <div className="relative w-48 h-48 mb-8" style={{ perspective: '600px' }}>
              <motion.div
                animate={coinFlipping ? { rotateY: [0, 1800] } : { rotateY: 0 }}
                transition={coinFlipping ? { duration: 2, ease: [0.25, 0.1, 0.25, 1] } : { duration: 0.3 }}
                className="w-full h-full relative"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div
                  className={cn(
                    'absolute inset-0 rounded-full border-4 flex items-center justify-center text-5xl font-bold',
                    coinResult === 'heads' && !coinFlipping
                      ? 'border-amber bg-amber/10 text-amber crt-glow-strong'
                      : 'border-border bg-surface text-text-secondary',
                  )}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="text-center">
                    <div className="text-5xl mb-1">H</div>
                    <div className="text-xs uppercase tracking-wider">Heads</div>
                  </div>
                </div>

                <div
                  className={cn(
                    'absolute inset-0 rounded-full border-4 flex items-center justify-center text-5xl font-bold',
                    coinResult === 'tails' && !coinFlipping
                      ? 'border-amber bg-amber/10 text-amber crt-glow-strong'
                      : 'border-border bg-surface text-text-secondary',
                  )}
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="text-center">
                    <div className="text-5xl mb-1">T</div>
                    <div className="text-xs uppercase tracking-wider">Tails</div>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="flex gap-4 w-full max-w-md">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedSide('heads')}
                disabled={isPlaying}
                className={cn(
                  'flex-1 py-4 rounded-xl font-mono text-lg font-bold transition-all duration-200 border-2',
                  selectedSide === 'heads'
                    ? 'border-amber bg-amber/10 text-amber crt-glow'
                    : 'border-border bg-surface text-text-secondary hover:border-amber-dim hover:text-text',
                  isPlaying && 'opacity-50 cursor-not-allowed',
                )}
              >
                HEADS
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedSide('tails')}
                disabled={isPlaying}
                className={cn(
                  'flex-1 py-4 rounded-xl font-mono text-lg font-bold transition-all duration-200 border-2',
                  selectedSide === 'tails'
                    ? 'border-amber bg-amber/10 text-amber crt-glow'
                    : 'border-border bg-surface text-text-secondary hover:border-amber-dim hover:text-text',
                  isPlaying && 'opacity-50 cursor-not-allowed',
                )}
              >
                TAILS
              </motion.button>
            </div>
          </div>

          <div className="card-glow bg-surface rounded-xl p-6 space-y-5">
            <BetInput
              value={betAmount}
              onChange={setBetAmount}
              disabled={isPlaying}
              maxBalance={walletBalance}
            />

            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-xs text-text-secondary">Win Chance</p>
                <p className="text-sm text-text font-mono">50%</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Multiplier</p>
                <p className="text-sm text-amber font-mono">1.96x</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Potential Payout</p>
                <p className="text-sm text-green font-mono">{formatTokenAmount(potentialPayout)} INIT</p>
              </div>
            </div>

            <TxStatus state={txState} hash={txHash} />

            {!isConnected ? (
              <div className="w-full py-4 rounded-xl font-mono text-lg font-bold text-center
                              bg-surface border-2 border-dashed border-amber-dim text-amber-dim">
                Connect wallet to play
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: selectedSide && !isPlaying ? 1.02 : 1 }}
                whileTap={{ scale: selectedSide && !isPlaying ? 0.98 : 1 }}
                onClick={handleFlip}
                disabled={!selectedSide || isPlaying}
                className={cn(
                  'w-full py-4 rounded-xl font-mono text-lg font-bold transition-all duration-200',
                  selectedSide && !isPlaying
                    ? 'bg-amber text-bg hover:bg-amber-light btn-glow cursor-pointer'
                    : 'bg-border text-text-dim cursor-not-allowed',
                )}
              >
                {isApproving ? (
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    APPROVING...
                  </motion.span>
                ) : isPlaying ? (
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    FLIPPING...
                  </motion.span>
                ) : !selectedSide ? (
                  'SELECT A SIDE'
                ) : (
                  `FLIP ${selectedSide.toUpperCase()}`
                )}
              </motion.button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <SessionKeyManager />

          <div className="card-glow bg-surface rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Recent Flips
            </h3>

            {recentDots.length === 0 ? (
              <p className="text-xs text-text-dim font-mono">No flips yet. Place your first bet!</p>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  <AnimatePresence mode="popLayout">
                    {recentDots.map((result, i) => (
                      <motion.div
                        key={result.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border',
                          result.won
                            ? 'bg-green/10 border-green/30 text-green'
                            : 'bg-red/10 border-red/30 text-red',
                        )}
                        title={`${result.outcome} - ${result.won ? 'Won' : 'Lost'} ${formatTokenAmount(result.won ? result.payout : result.betAmount)} INIT`}
                      >
                        {result.outcome === 'heads' ? 'H' : 'T'}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <p className="text-xs text-text-secondary">Wins</p>
                    <p className="text-sm text-green font-mono">
                      {results.filter(r => r.won).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Losses</p>
                    <p className="text-sm text-red font-mono">
                      {results.filter(r => !r.won).length}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card-glow bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Game Info
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">House Edge</span>
                <span className="text-text font-mono">2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Payout</span>
                <span className="text-amber font-mono">1.96x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Min Bet</span>
                <span className="text-text font-mono">0.1 INIT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Max Bet</span>
                <span className="text-text font-mono">100 INIT</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
