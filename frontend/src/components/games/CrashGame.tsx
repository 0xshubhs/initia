'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useBalance, usePublicClient, useWriteContract, useReadContract, useWatchContractEvent } from 'wagmi'
import BetInput from '@/components/shared/BetInput'
import TxStatus from '@/components/shared/TxStatus'
import SessionKeyManager from '@/components/wallet/SessionKeyManager'
import { CONTRACT_ADDRESSES, CRASH_GAME_ABI, ERC20_ABI, TOKEN_ADDRESS } from '@/config/contracts'
import { DEFAULT_BET, CRASH_TICK_INTERVAL } from '@/lib/constants'
import { formatTokenAmount, cn } from '@/lib/utils'
import type { TxState, CrashPoint } from '@/types'

// Round status enum matches the contract
enum RoundStatus {
  None = 0,
  Betting = 1,
  Running = 2,
  Crashed = 3,
}

type CrashPhase = 'waiting' | 'betting' | 'running' | 'crashed'

interface RoundData {
  roundId: bigint
  status: number
  serverCommitHash: `0x${string}`
  serverSeed: `0x${string}`
  crashPointBps: bigint
  bettingEndTime: bigint
  startTime: bigint
  totalBets: bigint
  totalPayouts: bigint
  playerCount: bigint
}

export default function CrashGame() {
  const [betAmount, setBetAmount] = useState(DEFAULT_BET)
  const [autoCashOut, setAutoCashOut] = useState<number>(2.0)
  const [phase, setPhase] = useState<CrashPhase>('waiting')
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0)
  const [crashPointDisplay, setCrashPointDisplay] = useState<number | null>(null)
  const [hasBet, setHasBet] = useState(false)
  const [cashedOut, setCashedOut] = useState(false)
  const [cashOutMultiplier, setCashOutMultiplier] = useState<number | null>(null)
  const [txState, setTxState] = useState<TxState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [chartPoints, setChartPoints] = useState<CrashPoint[]>([])
  const [history, setHistory] = useState<number[]>([])
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cashOutPayout, setCashOutPayout] = useState<bigint>(BigInt(0))
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundDataRef = useRef<RoundData | null>(null)
  const handleCashOutRef = useRef<() => void>(() => {})

  const { address, isConnected } = useAccount()
  const { data: balanceData } = useBalance({ address })
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const walletBalance = balanceData?.value ?? BigInt(0)

  // Read current round ID
  const { data: currentRoundId, refetch: refetchRoundId } = useReadContract({
    address: CONTRACT_ADDRESSES.crashGame,
    abi: CRASH_GAME_ABI,
    functionName: 'currentRoundId',
  })

  // Read current round data
  const { data: roundData, refetch: refetchRound } = useReadContract({
    address: CONTRACT_ADDRESSES.crashGame,
    abi: CRASH_GAME_ABI,
    functionName: 'getRound',
    args: currentRoundId ? [currentRoundId as bigint] : undefined,
    query: {
      enabled: currentRoundId !== undefined,
    },
  })

  // Parse round data
  const parsedRound = useMemo((): RoundData | null => {
    if (!roundData) return null
    const r = roundData as unknown as {
      roundId: bigint
      status: number
      serverCommitHash: `0x${string}`
      serverSeed: `0x${string}`
      crashPointBps: bigint
      bettingEndTime: bigint
      startTime: bigint
      totalBets: bigint
      totalPayouts: bigint
      playerCount: bigint
    }
    return {
      roundId: r.roundId,
      status: Number(r.status),
      serverCommitHash: r.serverCommitHash,
      serverSeed: r.serverSeed,
      crashPointBps: r.crashPointBps,
      bettingEndTime: r.bettingEndTime,
      startTime: r.startTime,
      totalBets: r.totalBets,
      totalPayouts: r.totalPayouts,
      playerCount: r.playerCount,
    }
  }, [roundData])

  // Keep ref in sync
  useEffect(() => {
    roundDataRef.current = parsedRound
  }, [parsedRound])

  // Watch for RoundCrashed events to update history
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.crashGame,
    abi: CRASH_GAME_ABI,
    eventName: 'RoundCrashed',
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: { crashPointBps: bigint } }).args
        if (args?.crashPointBps) {
          const cp = Number(args.crashPointBps) / 100
          setHistory(prev => [cp, ...prev].slice(0, 20))
        }
      }
    },
  })

  // Watch for CashedOut events for current player
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.crashGame,
    abi: CRASH_GAME_ABI,
    eventName: 'CashedOut',
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: { player: string; multiplierBps: bigint; payout: bigint } }).args
        if (args?.player?.toLowerCase() === address?.toLowerCase()) {
          setCashedOut(true)
          setCashOutMultiplier(Number(args.multiplierBps) / 100)
          setCashOutPayout(args.payout)
          setTxState('success')
        }
      }
    },
  })

  // ---- Chart drawing ----
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

  // ---- Cleanup timers ----
  const clearAllTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // ---- Update phase based on round data ----
  useEffect(() => {
    if (!parsedRound) {
      setPhase('waiting')
      return
    }

    const status = parsedRound.status

    if (status === RoundStatus.Betting) {
      setPhase('betting')

      // Update countdown
      const updateCountdown = () => {
        const now = Math.floor(Date.now() / 1000)
        const endTime = Number(parsedRound.bettingEndTime)
        const remaining = endTime - now
        if (remaining > 0) {
          setCountdown(remaining)
        } else {
          setCountdown(null)
        }
      }
      updateCountdown()
      const cdInterval = setInterval(updateCountdown, 1000)
      return () => clearInterval(cdInterval)

    } else if (status === RoundStatus.Running) {
      setPhase('running')
      setCountdown(null)

      // Clear any existing multiplier interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      const startTimeMs = Number(parsedRound.startTime) * 1000
      setChartPoints([{ time: 0, multiplier: 1.0 }])

      intervalRef.current = setInterval(() => {
        if (!isMountedRef.current) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return
        }
        const elapsed = Date.now() - startTimeMs
        if (elapsed < 0) return

        const mult = Math.exp(0.00006 * elapsed)
        const roundedMult = parseFloat(mult.toFixed(2))

        setCurrentMultiplier(roundedMult)
        setChartPoints(prev => {
          const newPoints = [...prev, { time: elapsed, multiplier: roundedMult }]
          drawChart(newPoints, false)
          return newPoints
        })

        // Auto cash out
        if (hasBet && !cashedOut && roundedMult >= autoCashOut && autoCashOut > 1) {
          handleCashOutRef.current()
        }
      }, CRASH_TICK_INTERVAL)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }

    } else if (status === RoundStatus.Crashed) {
      setPhase('crashed')
      setCountdown(null)

      // Stop multiplier ticker
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      const cp = Number(parsedRound.crashPointBps) / 100
      setCrashPointDisplay(cp)
      setCurrentMultiplier(cp)

      // Draw final chart state
      if (parsedRound.startTime > BigInt(0)) {
        const startTimeMs = Number(parsedRound.startTime) * 1000
        const crashTime = Math.log(cp) / 0.00006
        setChartPoints(prev => {
          const finalPoints = [...prev, { time: crashTime, multiplier: cp }]
          drawChart(finalPoints, true)
          return finalPoints
        })
      }

      // Add to history if not already there
      setHistory(prev => {
        if (prev.length > 0 && prev[0] === cp) return prev
        return [cp, ...prev].slice(0, 20)
      })

    } else {
      // RoundStatus.None - waiting for a new round
      setPhase('waiting')
      setHasBet(false)
      setCashedOut(false)
      setCashOutMultiplier(null)
      setCashOutPayout(BigInt(0))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedRound?.status, parsedRound?.bettingEndTime, parsedRound?.startTime, parsedRound?.crashPointBps, drawChart, autoCashOut])

  // ---- Poll round data ----
  useEffect(() => {
    isMountedRef.current = true

    const poll = () => {
      refetchRoundId()
      refetchRound()
    }

    // Poll every 2 seconds
    pollRef.current = setInterval(poll, 2000)
    // Initial fetch
    poll()

    return () => {
      isMountedRef.current = false
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      clearAllTimers()
    }
  }, [refetchRoundId, refetchRound, clearAllTimers])

  // ---- Reset bet state when round changes ----
  useEffect(() => {
    if (parsedRound?.status === RoundStatus.Betting) {
      setHasBet(false)
      setCashedOut(false)
      setCashOutMultiplier(null)
      setCashOutPayout(BigInt(0))
      setTxState('idle')
      setTxHash(null)
      setErrorMsg(null)
    }
  }, [currentRoundId, parsedRound?.status])

  // ---- Place Bet ----
  const handlePlaceBet = useCallback(async () => {
    if (phase !== 'betting' || hasBet || !isConnected || !address || !currentRoundId) return
    setErrorMsg(null)

    try {
      // Step 1: ERC20 Approval
      setTxState('confirming')

      try {
        const approveHash = await writeContractAsync({
          address: TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.crashGame, betAmount],
        })
        setTxHash(approveHash)
        setTxState('pending')

        // Wait for approval confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash })
        }
      } catch (approveErr: unknown) {
        // If approval fails, it might be because the token uses native value instead
        // Continue with placing the bet
        console.warn('Approval step skipped or failed, continuing...', approveErr)
      }

      // Step 2: Place bet
      setTxState('confirming')
      const betHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.crashGame,
        abi: CRASH_GAME_ABI,
        functionName: 'placeBet',
        args: [currentRoundId as bigint, betAmount],
      })

      setTxHash(betHash)
      setTxState('pending')

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: betHash })
      }

      setTxState('success')
      setHasBet(true)
    } catch (err: unknown) {
      setTxState('error')
      const message = err instanceof Error ? err.message : 'Transaction failed'
      setErrorMsg(message.length > 80 ? message.slice(0, 80) + '...' : message)
    }
  }, [phase, hasBet, isConnected, address, currentRoundId, betAmount, writeContractAsync, publicClient])

  // ---- Cash Out ----
  const handleCashOut = useCallback(async () => {
    if (phase !== 'running' || !hasBet || cashedOut || !currentRoundId || !isConnected) return
    setErrorMsg(null)

    try {
      const multiplierBps = BigInt(Math.floor(currentMultiplier * 100))

      setTxState('confirming')
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.crashGame,
        abi: CRASH_GAME_ABI,
        functionName: 'cashOut',
        args: [currentRoundId as bigint, multiplierBps],
      })

      setTxHash(hash)
      setTxState('pending')

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
      }

      setCashedOut(true)
      setCashOutMultiplier(currentMultiplier)
      const estimatedPayout = (betAmount * BigInt(Math.floor(currentMultiplier * 100))) / BigInt(100)
      setCashOutPayout(estimatedPayout)
      setTxState('success')
    } catch (err: unknown) {
      setTxState('error')
      const message = err instanceof Error ? err.message : 'Cash out failed'
      setErrorMsg(message.length > 80 ? message.slice(0, 80) + '...' : message)
    }
  }, [phase, hasBet, cashedOut, currentRoundId, isConnected, currentMultiplier, writeContractAsync, publicClient, betAmount])

  // Keep ref in sync for use inside intervals
  handleCashOutRef.current = handleCashOut

  // ---- Computed values ----
  const payout = cashedOut && cashOutMultiplier
    ? cashOutPayout > BigInt(0)
      ? cashOutPayout
      : (betAmount * BigInt(Math.floor(cashOutMultiplier * 100))) / BigInt(100)
    : BigInt(0)

  const roundInfo = parsedRound
    ? {
        players: Number(parsedRound.playerCount),
        totalBets: parsedRound.totalBets,
      }
    : null

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
                    <p className="text-2xl font-bold font-mono text-red mt-1">@ {crashPointDisplay?.toFixed(2)}x</p>
                  </motion.div>
                )}
                {phase === 'betting' && (
                  <motion.div key="betting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-4xl font-bold font-mono text-amber animate-glow-pulse">
                      {countdown !== null && countdown > 0
                        ? <span>Starting in {countdown}s</span>
                        : 'Place your bets...'}
                    </p>
                    {roundInfo && (
                      <p className="text-sm text-text-secondary font-mono mt-2">
                        {roundInfo.players} player{roundInfo.players !== 1 ? 's' : ''} | Pool: {formatTokenAmount(roundInfo.totalBets)} INIT
                      </p>
                    )}
                  </motion.div>
                )}
                {phase === 'waiting' && (
                  <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-3xl font-bold font-mono text-text-secondary">
                      Waiting for next round...
                    </p>
                    <p className="text-sm text-text-dim font-mono mt-2">
                      Round #{currentRoundId?.toString() ?? '--'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {cashedOut && cashOutMultiplier && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-4 px-4 py-2 rounded-lg bg-green/10 border border-green/30">
                  <p className="text-green font-mono text-sm">Cashed out @ {cashOutMultiplier.toFixed(2)}x</p>
                  <p className="text-green font-mono text-lg font-bold">
                    +{formatTokenAmount(payout > betAmount ? payout - betAmount : BigInt(0))} INIT
                  </p>
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
                maxBalance={walletBalance}
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
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      if (isNaN(val)) { setAutoCashOut(1.1); return }
                      setAutoCashOut(Math.min(1000, Math.max(1.01, val)))
                    }}
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

            <TxStatus state={txState} hash={txHash} error={errorMsg ?? undefined} />

            {!isConnected ? (
              <div className="w-full py-4 rounded-xl font-mono text-lg font-bold text-center
                              bg-surface border-2 border-dashed border-amber-dim text-amber-dim">
                Connect wallet to play
              </div>
            ) : phase === 'running' && hasBet && !cashedOut ? (
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
                disabled={phase !== 'betting' || hasBet || txState === 'pending' || txState === 'confirming'}
                className={cn(
                  'w-full py-4 rounded-xl font-mono text-lg font-bold transition-all duration-200',
                  phase === 'betting' && !hasBet && txState !== 'pending' && txState !== 'confirming'
                    ? 'bg-amber text-bg hover:bg-amber-light btn-glow cursor-pointer'
                    : hasBet
                    ? 'bg-green/20 text-green border border-green/30 cursor-default'
                    : 'bg-border text-text-dim cursor-not-allowed',
                )}
              >
                {txState === 'confirming' || txState === 'pending' ? (
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    {txState === 'confirming' ? 'CONFIRM IN WALLET...' : 'PROCESSING...'}
                  </motion.span>
                ) : hasBet ? (
                  'BET PLACED'
                ) : phase === 'betting' ? (
                  'PLACE BET'
                ) : (
                  'WAIT FOR NEXT ROUND'
                )}
              </motion.button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <SessionKeyManager />

          <div className="card-glow bg-surface rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Recent Crashes</h3>
            {history.length === 0 ? (
              <p className="text-xs text-text-dim font-mono">No crash history yet.</p>
            ) : (
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
            )}
          </div>

          {parsedRound && (
            <div className="card-glow bg-surface rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Round Info</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Round ID</span>
                  <span className="text-text font-mono">#{parsedRound.roundId.toString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Players</span>
                  <span className="text-text font-mono">{parsedRound.playerCount.toString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Pool</span>
                  <span className="text-amber font-mono">{formatTokenAmount(parsedRound.totalBets)} INIT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Status</span>
                  <span className={cn(
                    'font-mono',
                    phase === 'running' ? 'text-green' :
                    phase === 'crashed' ? 'text-red' :
                    phase === 'betting' ? 'text-amber' : 'text-text-dim'
                  )}>
                    {phase.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

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
                <span className="text-text-secondary">Results</span>
                <span className="text-text font-mono">On-chain verified</span>
              </div>
            </div>
            <p className="text-[10px] text-text-dim pt-2 border-t border-border leading-relaxed">
              The multiplier starts at 1.00x and increases. Cash out before it crashes!
              If you don&apos;t cash out before the crash, you lose your bet.
              All results are determined on-chain by the operator&apos;s server seed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
