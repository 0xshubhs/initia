'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BetInput from '@/components/shared/BetInput'
import TxStatus from '@/components/shared/TxStatus'
import SessionKeyManager from '@/components/wallet/SessionKeyManager'
import { DEFAULT_BET, CRASH_TICK_INTERVAL } from '@/lib/constants'
import { formatTokenAmount, generateCrashPoint, cn, sleep } from '@/lib/utils'
import type { TxState, CrashPoint } from '@/types'

type CrashPhase = 'waiting' | 'betting' | 'running' | 'crashed' | 'cashed_out'

export default function CrashGame() {
  const [betAmount, setBetAmount] = useState(DEFAULT_BET)
  const [autoCashOut, setAutoCashOut] = useState<number>(2.0)
  const [phase, setPhase] = useState<CrashPhase>('waiting')
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0)
  const [crashPoint, setCrashPoint] = useState<number | null>(null)
  const [hasBet, setHasBet] = useState(false)
  const [cashedOut, setCashedOut] = useState(false)
  const [cashOutMultiplier, setCashOutMultiplier] = useState<number | null>(null)
  const [txState, setTxState] = useState<TxState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [chartPoints, setChartPoints] = useState<CrashPoint[]>([])
  const [history, setHistory] = useState<number[]>([2.45, 1.12, 5.67, 1.03, 3.21, 1.88, 12.5, 1.45, 2.1, 1.67])
  const [countdown, setCountdown] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const drawChart = useCallback((points: CrashPoint[], crashed: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)

    const width = rect.width
    const height = rect.height

    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(34, 34, 34, 0.8)'
    ctx.lineWidth = 0.5
    for (let i = 0; i < 10; i++) {
      const y = (height / 10) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    for (let i = 0; i < 10; i++) {
      const x = (width / 10) * i
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    if (points.length < 2) return

    const maxTime = Math.max(points[points.length - 1].time, 5000)
    const maxMultiplier = Math.max(points[points.length - 1].multiplier, 2)
    const padding = 30

    ctx.beginPath()
    ctx.strokeStyle = crashed ? '#ff0040' : '#ffb000'
    ctx.lineWidth = 2.5
    ctx.shadowColor = crashed ? 'rgba(255, 0, 64, 0.5)' : 'rgba(255, 176, 0, 0.5)'
    ctx.shadowBlur = 8

    points.forEach((point, i) => {
      const x = padding + ((width - padding * 2) * point.time) / maxTime
      const y = height - padding - ((height - padding * 2) * (point.multiplier - 1)) / (maxMultiplier - 1)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    const lastPoint = points[points.length - 1]
    const lastX = padding + ((width - padding * 2) * lastPoint.time) / maxTime
    ctx.lineTo(lastX, height - padding)
    ctx.lineTo(padding, height - padding)
    ctx.closePath()

    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    if (crashed) {
      gradient.addColorStop(0, 'rgba(255, 0, 64, 0.15)')
      gradient.addColorStop(1, 'rgba(255, 0, 64, 0)')
    } else {
      gradient.addColorStop(0, 'rgba(255, 176, 0, 0.15)')
      gradient.addColorStop(1, 'rgba(255, 176, 0, 0)')
    }
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.fillStyle = '#555555'
    ctx.font = '10px JetBrains Mono, monospace'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const mult = 1 + ((maxMultiplier - 1) * i) / 4
      const y = height - padding - ((height - padding * 2) * (mult - 1)) / (maxMultiplier - 1)
      ctx.fillText(`${mult.toFixed(1)}x`, padding - 5, y + 3)
    }
  }, [])

  const startRound = useCallback(async () => {
    setPhase('betting')
    for (let i = 5; i > 0; i--) {
      setCountdown(i)
      await sleep(1000)
    }
    setCountdown(null)

    const cp = generateCrashPoint()
    setCrashPoint(cp)
    setCurrentMultiplier(1.0)
    setChartPoints([{ time: 0, multiplier: 1.0 }])
    setCashedOut(false)
    setCashOutMultiplier(null)
    setPhase('running')
    startTimeRef.current = Date.now()

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const mult = Math.exp(0.00006 * elapsed)
      const roundedMult = parseFloat(mult.toFixed(2))

      if (roundedMult >= cp) {
        setCurrentMultiplier(cp)
        setChartPoints(prev => {
          const newPoints = [...prev, { time: elapsed, multiplier: cp }]
          drawChart(newPoints, true)
          return newPoints
        })
        if (intervalRef.current) clearInterval(intervalRef.current)
        setPhase('crashed')
        setHistory(prev => [cp, ...prev].slice(0, 20))
        setTimeout(() => {
          setHasBet(false)
          startRound()
        }, 4000)
      } else {
        setCurrentMultiplier(roundedMult)
        setChartPoints(prev => {
          const newPoints = [...prev, { time: elapsed, multiplier: roundedMult }]
          drawChart(newPoints, false)
          return newPoints
        })
      }
    }, CRASH_TICK_INTERVAL)
  }, [drawChart])

  useEffect(() => {
    startRound()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCashOut = useCallback(() => {
    if (phase !== 'running' || !hasBet || cashedOut) return
    setCashedOut(true)
    setCashOutMultiplier(currentMultiplier)
    setTxState('success')
  }, [phase, hasBet, cashedOut, currentMultiplier])

  useEffect(() => {
    if (phase === 'running' && hasBet && !cashedOut && currentMultiplier >= autoCashOut && autoCashOut > 1) {
      handleCashOut()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMultiplier, phase, hasBet, cashedOut, autoCashOut])

  const handlePlaceBet = useCallback(async () => {
    if (phase !== 'betting' || hasBet) return
    setTxState('confirming')
    await sleep(300)
    setTxState('pending')
    setTxHash(`0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`)
    await sleep(500)
    setTxState('success')
    setHasBet(true)
  }, [phase, hasBet])

  const payout = cashedOut && cashOutMultiplier
    ? (betAmount * BigInt(Math.floor(cashOutMultiplier * 100))) / BigInt(100)
    : BigInt(0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-glow bg-surface rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-6 left-6 z-10">
              <AnimatePresence mode="wait">
                {phase === 'running' && (
                  <motion.div key="running" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <p className="text-6xl sm:text-7xl font-black font-mono text-amber crt-glow-strong">
                      {currentMultiplier.toFixed(2)}x
                    </p>
                  </motion.div>
                )}
                {phase === 'crashed' && (
                  <motion.div key="crashed" initial={{ scale: 2 }} animate={{ scale: 1 }} className="animate-glitch">
                    <p className="text-6xl sm:text-7xl font-black font-mono text-red crt-glow-red">CRASHED</p>
                    <p className="text-2xl font-bold font-mono text-red mt-1">@ {crashPoint?.toFixed(2)}x</p>
                  </motion.div>
                )}
                {phase === 'betting' && (
                  <motion.div key="betting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-4xl font-bold font-mono text-amber animate-glow-pulse">
                      {countdown !== null ? <span>Starting in {countdown}s</span> : 'Place your bets...'}
                    </p>
                  </motion.div>
                )}
                {phase === 'waiting' && (
                  <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-3xl font-bold font-mono text-text-secondary">Loading next round...</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {cashedOut && cashOutMultiplier && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-4 px-4 py-2 rounded-lg bg-green/10 border border-green/30">
                  <p className="text-green font-mono text-sm">Cashed out @ {cashOutMultiplier.toFixed(2)}x</p>
                  <p className="text-green font-mono text-lg font-bold">+{formatTokenAmount(payout - betAmount)} INIT</p>
                </motion.div>
              )}
            </div>

            <canvas ref={canvasRef} className="w-full h-[320px] sm:h-[380px] rounded-lg" />
          </div>

          <div className="card-glow bg-surface rounded-xl p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <BetInput
                value={betAmount}
                onChange={setBetAmount}
                disabled={phase !== 'betting' || hasBet}
                maxBalance={BigInt('100000000000000000000')}
              />

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-text-secondary">Auto Cash Out</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1.1"
                    max="100"
                    value={autoCashOut}
                    onChange={e => setAutoCashOut(parseFloat(e.target.value) || 1.1)}
                    disabled={phase === 'running'}
                    className="w-full bg-bg border border-border rounded-lg px-4 py-3 font-mono text-lg
                               text-text placeholder-text-dim
                               disabled:opacity-50 disabled:cursor-not-allowed
                               transition-all duration-200"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary text-sm">x</span>
                </div>
                <div className="flex gap-2">
                  {[1.5, 2, 3, 5, 10].map(v => (
                    <button
                      key={v}
                      onClick={() => setAutoCashOut(v)}
                      disabled={phase === 'running'}
                      className="flex-1 px-2 py-1.5 text-xs font-medium rounded-md
                                 bg-surface border border-border text-text-secondary
                                 hover:border-amber-dim hover:text-amber
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-all duration-200"
                    >
                      {v}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <TxStatus state={txState} hash={txHash} />

            {phase === 'running' && hasBet && !cashedOut ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCashOut}
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(0, 255, 65, 0.2)',
                    '0 0 40px rgba(0, 255, 65, 0.4)',
                    '0 0 20px rgba(0, 255, 65, 0.2)',
                  ],
                }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-full py-5 rounded-xl font-mono text-xl font-bold
                           bg-green text-bg hover:bg-green/90
                           cursor-pointer transition-colors duration-200"
              >
                CASH OUT @ {currentMultiplier.toFixed(2)}x
                <span className="block text-sm font-normal mt-1">
                  = {formatTokenAmount((betAmount * BigInt(Math.floor(currentMultiplier * 100))) / BigInt(100))} INIT
                </span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: phase === 'betting' && !hasBet ? 1.02 : 1 }}
                whileTap={{ scale: phase === 'betting' && !hasBet ? 0.98 : 1 }}
                onClick={handlePlaceBet}
                disabled={phase !== 'betting' || hasBet}
                className={cn(
                  'w-full py-4 rounded-xl font-mono text-lg font-bold transition-all duration-200',
                  phase === 'betting' && !hasBet
                    ? 'bg-amber text-bg hover:bg-amber-light btn-glow cursor-pointer'
                    : hasBet
                    ? 'bg-green/20 text-green border border-green/30 cursor-default'
                    : 'bg-border text-text-dim cursor-not-allowed',
                )}
              >
                {hasBet ? 'BET PLACED' : phase === 'betting' ? 'PLACE BET' : 'WAIT FOR NEXT ROUND'}
              </motion.button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <SessionKeyManager />

          <div className="card-glow bg-surface rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Recent Crashes</h3>
            <div className="flex flex-wrap gap-2">
              {history.map((point, i) => (
                <motion.div
                  key={`${point}-${i}`}
                  initial={i === 0 ? { scale: 0 } : {}}
                  animate={{ scale: 1 }}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-mono font-bold',
                    point >= 2
                      ? 'bg-green/10 text-green border border-green/20'
                      : 'bg-red/10 text-red border border-red/20',
                  )}
                >
                  {point.toFixed(2)}x
                </motion.div>
              ))}
            </div>
          </div>

          <div className="card-glow bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Game Info</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">House Edge</span>
                <span className="text-text font-mono">3%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Max Multiplier</span>
                <span className="text-amber font-mono">1000x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Round Time</span>
                <span className="text-text font-mono">5s countdown</span>
              </div>
            </div>
            <p className="text-[10px] text-text-dim pt-2 border-t border-border leading-relaxed">
              The multiplier starts at 1.00x and increases. Cash out before it crashes!
              If you don&apos;t cash out before the crash, you lose your bet.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
