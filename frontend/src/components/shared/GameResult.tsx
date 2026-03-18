'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatTokenAmount } from '@/lib/utils'
import type { GameStatus } from '@/types'

interface GameResultProps {
  status: GameStatus
  won: boolean
  payout: bigint
  betAmount: bigint
  outcome?: string
  onDismiss?: () => void
}

export default function GameResult({ status, won, payout, betAmount, outcome, onDismiss }: GameResultProps) {
  const [show, setShow] = useState(false)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  const handleDismiss = useCallback(() => {
    setShow(false)
    onDismissRef.current?.()
  }, [])

  useEffect(() => {
    if (status === 'won' || status === 'lost') {
      setShow(true)
      const timeout = setTimeout(handleDismiss, 4000)
      return () => clearTimeout(timeout)
    } else {
      setShow(false)
    }
  }, [status, handleDismiss])

  const profit = won ? payout - betAmount : betAmount

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <div
            className={`pointer-events-auto p-8 rounded-2xl border-2 backdrop-blur-sm
              ${won
                ? 'bg-green/5 border-green shadow-[0_0_60px_rgba(0,255,65,0.15)]'
                : 'bg-red/5 border-red shadow-[0_0_60px_rgba(255,0,64,0.15)]'
              }`}
            onClick={handleDismiss}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', damping: 10 }}
              className="text-center"
            >
              <div className={`text-6xl mb-4 ${won ? 'animate-glitch' : ''}`}>
                {won ? (
                  <span className="crt-glow-green">W</span>
                ) : (
                  <span className="crt-glow-red">L</span>
                )}
              </div>

              <h2
                className={`text-3xl font-bold mb-2 ${
                  won ? 'text-green crt-glow-green' : 'text-red crt-glow-red'
                }`}
              >
                {won ? 'YOU WIN!' : 'YOU LOSE'}
              </h2>

              {outcome && (
                <p className="text-text-secondary text-sm mb-4">
                  Result: <span className="text-text font-medium">{outcome}</span>
                </p>
              )}

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`text-4xl font-bold font-mono ${
                  won ? 'text-green' : 'text-red'
                }`}
              >
                {won ? '+' : '-'}{formatTokenAmount(profit)} INIT
              </motion.p>

              {won && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-text-secondary text-sm mt-2"
                >
                  Payout: {formatTokenAmount(payout)} INIT
                </motion.p>
              )}

              <p className="text-text-dim text-xs mt-4">Click to dismiss</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
