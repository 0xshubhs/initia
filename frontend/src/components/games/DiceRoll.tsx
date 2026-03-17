'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '@/hooks/useGame'
import BetInput from '@/components/shared/BetInput'
import GameResult from '@/components/shared/GameResult'
import TxStatus from '@/components/shared/TxStatus'
import SessionKeyManager from '@/components/wallet/SessionKeyManager'
import { DEFAULT_BET, DICE_MIN_TARGET, DICE_MAX_TARGET } from '@/lib/constants'
import { formatTokenAmount, calculateDicePayout, calculateDiceWinChance, cn } from '@/lib/utils'

export default function DiceRoll() {
  const [betAmount, setBetAmount] = useState(DEFAULT_BET)
  const [target, setTarget] = useState(50)
  const [rollUnder, setRollUnder] = useState(true)
  const [showDiceResult, setShowDiceResult] = useState(false)
  const [diceValue, setDiceValue] = useState<number | null>(null)

  const { status, txState, txHash, lastResult, results, isPlaying, placeBet, reset } = useGame({
    gameType: 'diceroll',
  })

  const payout = useMemo(() => calculateDicePayout(rollUnder ? target : 100 - target), [target, rollUnder])
  const winChance = useMemo(() => calculateDiceWinChance(rollUnder ? target : 100 - target), [target, rollUnder])
  const potentialPayout = useMemo(() => {
    const payoutBig = BigInt(Math.floor(payout * 100))
    return (betAmount * payoutBig) / BigInt(100)
  }, [betAmount, payout])

  const handleRoll = useCallback(async () => {
    if (isPlaying) return

    setShowDiceResult(false)
    setDiceValue(null)

    const result = await placeBet({
      amount: betAmount,
      target,
      rollUnder,
    })

    setDiceValue(parseInt(result.outcome))
    setShowDiceResult(true)
  }, [isPlaying, betAmount, target, rollUnder, placeBet])

  const ticks = useMemo(() => {
    const marks: number[] = []
    for (let i = 0; i <= 100; i += 10) {
      marks.push(i)
    }
    return marks
  }, [])

  return (
    <div className="space-y-6">
      <GameResult
        status={status}
        won={lastResult?.won ?? false}
        payout={lastResult?.payout ?? BigInt(0)}
        betAmount={lastResult?.betAmount ?? BigInt(0)}
        outcome={lastResult ? `Rolled ${lastResult.outcome}` : undefined}
        onDismiss={reset}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-glow bg-surface rounded-xl p-8">
            <div className="flex flex-col items-center mb-8">
              <AnimatePresence mode="wait">
                {showDiceResult && diceValue !== null ? (
                  <motion.div
                    key="result"
                    initial={{ scale: 0, rotateZ: -180 }}
                    animate={{ scale: 1, rotateZ: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', damping: 12 }}
                    className={cn(
                      'w-32 h-32 rounded-2xl border-4 flex items-center justify-center mb-4',
                      lastResult?.won
                        ? 'border-green bg-green/10 text-green crt-glow-green'
                        : 'border-red bg-red/10 text-red crt-glow-red',
                    )}
                  >
                    <span className="text-5xl font-bold font-mono">{diceValue}</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    className="w-32 h-32 rounded-2xl border-4 border-border bg-surface flex items-center justify-center mb-4"
                  >
                    {isPlaying ? (
                      <motion.span
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="text-5xl font-bold font-mono text-amber"
                      >
                        ?
                      </motion.span>
                    ) : (
                      <span className="text-5xl font-bold font-mono text-text-dim">--</span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-sm text-text-secondary font-mono">
                {rollUnder ? `Roll Under ${target}` : `Roll Over ${target}`}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary uppercase tracking-wider">Target Number</span>
                <span className="text-lg text-amber font-bold font-mono crt-glow">{target}</span>
              </div>

              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-200"
                    style={{
                      background: rollUnder
                        ? `linear-gradient(to right, rgba(0,255,65,0.3) ${target}%, rgba(255,0,64,0.3) ${target}%)`
                        : `linear-gradient(to right, rgba(255,0,64,0.3) ${target}%, rgba(0,255,65,0.3) ${target}%)`,
                    }}
                  />
                </div>

                <input
                  type="range"
                  min={DICE_MIN_TARGET}
                  max={DICE_MAX_TARGET}
                  value={target}
                  onChange={e => setTarget(parseInt(e.target.value))}
                  disabled={isPlaying}
                  className="relative w-full z-10 disabled:opacity-50"
                />

                <div className="flex justify-between px-1 mt-2">
                  {ticks.map(tick => (
                    <span key={tick} className="text-[10px] text-text-dim font-mono">{tick}</span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={() => setRollUnder(true)}
                  disabled={isPlaying}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-mono font-semibold border transition-all duration-200',
                    rollUnder
                      ? 'border-green bg-green/10 text-green'
                      : 'border-border text-text-secondary hover:border-text-dim',
                    isPlaying && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  Roll Under
                </button>
                <button
                  onClick={() => setRollUnder(false)}
                  disabled={isPlaying}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-mono font-semibold border transition-all duration-200',
                    !rollUnder
                      ? 'border-green bg-green/10 text-green'
                      : 'border-border text-text-secondary hover:border-text-dim',
                    isPlaying && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  Roll Over
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-xs text-text-secondary mb-1">Win Chance</p>
                <p className="text-lg text-text font-mono font-bold">{winChance}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-secondary mb-1">Multiplier</p>
                <p className="text-lg text-amber font-mono font-bold crt-glow">{payout}x</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-secondary mb-1">Payout</p>
                <p className="text-lg text-green font-mono font-bold">{formatTokenAmount(potentialPayout)}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <motion.div
                  animate={{ width: `${winChance}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, #00ff41 0%, ${winChance > 50 ? '#ffd000' : '#00ff41'} 100%)`,
                    boxShadow: '0 0 8px rgba(0, 255, 65, 0.3)',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="card-glow bg-surface rounded-xl p-6 space-y-5">
            <BetInput
              value={betAmount}
              onChange={setBetAmount}
              disabled={isPlaying}
              maxBalance={BigInt('100000000000000000000')}
            />

            <TxStatus state={txState} hash={txHash} />

            <motion.button
              whileHover={{ scale: !isPlaying ? 1.02 : 1 }}
              whileTap={{ scale: !isPlaying ? 0.98 : 1 }}
              onClick={handleRoll}
              disabled={isPlaying}
              className={cn(
                'w-full py-4 rounded-xl font-mono text-lg font-bold transition-all duration-200',
                !isPlaying
                  ? 'bg-amber text-bg hover:bg-amber-light btn-glow cursor-pointer'
                  : 'bg-border text-text-dim cursor-not-allowed',
              )}
            >
              {isPlaying ? (
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ROLLING...
                </motion.span>
              ) : (
                `ROLL ${rollUnder ? 'UNDER' : 'OVER'} ${target}`
              )}
            </motion.button>
          </div>
        </div>

        <div className="space-y-6">
          <SessionKeyManager />

          <div className="card-glow bg-surface rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Recent Rolls
            </h3>

            {results.length === 0 ? (
              <p className="text-xs text-text-dim font-mono">No rolls yet. Place your first bet!</p>
            ) : (
              <div className="space-y-2">
                {results.slice(0, 10).map((result, i) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono',
                      result.won ? 'bg-green/5 text-green' : 'bg-red/5 text-red',
                    )}
                  >
                    <span className="font-bold">{result.outcome}</span>
                    <span>
                      {result.won ? '+' : '-'}{formatTokenAmount(result.won ? result.payout - result.betAmount : result.betAmount)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="card-glow bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Game Info
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">House Edge</span>
                <span className="text-text font-mono">1%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Range</span>
                <span className="text-text font-mono">1 - 100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Max Payout</span>
                <span className="text-amber font-mono">99x</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
