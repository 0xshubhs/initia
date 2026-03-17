'use client'

import { motion } from 'framer-motion'
import { useHouseVault } from '@/hooks/useHouseVault'
import StatCard from '@/components/shared/StatCard'
import { formatTokenAmount } from '@/lib/utils'
import { useRef, useEffect, useCallback } from 'react'

export default function VaultStats() {
  const { stats } = useHouseVault()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const drawProfitChart = useCallback(() => {
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

    ctx.fillStyle = '#111111'
    ctx.fillRect(0, 0, width, height)

    const days = 30
    const dataPoints: number[] = []
    let cumulative = 0
    for (let i = 0; i < days; i++) {
      const daily = (Math.random() - 0.35) * 15
      cumulative += daily
      dataPoints.push(cumulative)
    }

    const padding = 20
    const maxVal = Math.max(...dataPoints, 0)
    const minVal = Math.min(...dataPoints, 0)
    const range = maxVal - minVal || 1

    const zeroY = padding + ((maxVal) / range) * (height - padding * 2)
    ctx.strokeStyle = 'rgba(34, 34, 34, 0.8)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(padding, zeroY)
    ctx.lineTo(width - padding, zeroY)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.beginPath()
    ctx.strokeStyle = '#ffb000'
    ctx.lineWidth = 2
    ctx.shadowColor = 'rgba(255, 176, 0, 0.3)'
    ctx.shadowBlur = 6

    dataPoints.forEach((value, i) => {
      const x = padding + ((width - padding * 2) * i) / (days - 1)
      const y = padding + ((maxVal - value) / range) * (height - padding * 2)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    const lastIndex = dataPoints.length - 1
    const lastX = padding + ((width - padding * 2) * lastIndex) / (days - 1)
    ctx.lineTo(lastX, zeroY)
    ctx.lineTo(padding, zeroY)
    ctx.closePath()

    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(255, 176, 0, 0.1)')
    gradient.addColorStop(1, 'rgba(255, 176, 0, 0)')
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.fillStyle = '#555555'
    ctx.font = '9px JetBrains Mono, monospace'
    ctx.textAlign = 'left'
    ctx.fillText('30d ago', padding, height - 4)
    ctx.textAlign = 'right'
    ctx.fillText('Today', width - padding, height - 4)
  }, [])

  useEffect(() => {
    drawProfitChart()
    const resizeObserver = new ResizeObserver(drawProfitChart)
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current)
    }
    return () => resizeObserver.disconnect()
  }, [drawProfitChart])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Value Locked" value={formatTokenAmount(stats.tvl)} suffix="INIT" variant="amber" size="lg" />
        <StatCard label="Current APY" value={stats.apy.toFixed(2)} suffix="%" variant="green" size="lg" change={0.5} />
        <StatCard label="Net Profit" value={formatTokenAmount(stats.netProfit)} suffix="INIT" variant={Number(stats.netProfit) >= 0 ? 'green' : 'red'} />
        <StatCard label="Depositors" value={stats.totalDepositors.toString()} variant="default" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-glow bg-surface rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Vault Performance (30d)</h3>
          <span className="text-xs text-green font-mono">+{formatTokenAmount(stats.netProfit)} INIT</span>
        </div>
        <canvas ref={canvasRef} className="w-full h-[200px] rounded-lg" />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-glow bg-surface rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Revenue Sources</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber" />
                <span className="text-xs text-text-secondary">House Edge Revenue</span>
              </div>
              <span className="text-xs text-text font-mono">{formatTokenAmount(stats.totalProfit)} INIT</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red" />
                <span className="text-xs text-text-secondary">Player Payouts</span>
              </div>
              <span className="text-xs text-text font-mono">-{formatTokenAmount(stats.totalLoss)} INIT</span>
            </div>
            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-xs text-text font-semibold">Net</span>
              <span className="text-xs text-green font-mono font-semibold">+{formatTokenAmount(stats.netProfit)} INIT</span>
            </div>
          </div>
        </div>

        <div className="card-glow bg-surface rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Your Position</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Your Deposit</span>
              <span className="text-xs text-text font-mono">{formatTokenAmount(stats.userDeposit)} INIT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Your Share</span>
              <span className="text-xs text-amber font-mono">{stats.userShare.toFixed(4)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Pending Rewards</span>
              <span className="text-xs text-green font-mono">{formatTokenAmount(stats.pendingRewards)} INIT</span>
            </div>
            <div className="h-2 rounded-full bg-border overflow-hidden">
              <div className="h-full rounded-full bg-amber" style={{ width: `${Math.min(stats.userShare, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
