'use client'

import { motion } from 'framer-motion'
import { useHouseVault } from '@/hooks/useHouseVault'
import StatCard from '@/components/shared/StatCard'
import { formatTokenAmount, cn } from '@/lib/utils'
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

    // With on-chain data, we only have current snapshot values.
    // Draw a single-point indicator showing current net profit position.
    const netProfitNum = Number(stats.netProfit) / 1e18
    const padding = 20

    // Draw zero line
    const zeroY = height / 2
    ctx.strokeStyle = 'rgba(34, 34, 34, 0.8)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(padding, zeroY)
    ctx.lineTo(width - padding, zeroY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw a horizontal bar representing net profit
    const maxRange = Math.max(Math.abs(netProfitNum), 100)
    const barHeight = 30
    const barY = (height - barHeight) / 2
    const barWidth = Math.min(Math.abs(netProfitNum / maxRange) * (width - padding * 2) * 0.8, width - padding * 2)
    const isPositive = netProfitNum >= 0

    ctx.fillStyle = isPositive ? 'rgba(0, 255, 65, 0.2)' : 'rgba(255, 0, 64, 0.2)'
    ctx.strokeStyle = isPositive ? '#00ff41' : '#ff0040'
    ctx.lineWidth = 2
    ctx.shadowColor = isPositive ? 'rgba(0, 255, 65, 0.3)' : 'rgba(255, 0, 64, 0.3)'
    ctx.shadowBlur = 6

    const startX = width / 2
    if (isPositive) {
      ctx.fillRect(startX, barY, barWidth / 2, barHeight)
      ctx.strokeRect(startX, barY, barWidth / 2, barHeight)
    } else {
      ctx.fillRect(startX - barWidth / 2, barY, barWidth / 2, barHeight)
      ctx.strokeRect(startX - barWidth / 2, barY, barWidth / 2, barHeight)
    }
    ctx.shadowBlur = 0

    // Labels
    ctx.fillStyle = '#555555'
    ctx.font = '9px JetBrains Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Net P&L', width / 2, height - 6)

    ctx.textAlign = 'left'
    ctx.fillText('Loss', padding, height - 6)
    ctx.textAlign = 'right'
    ctx.fillText('Profit', width - padding, height - 6)

    // Show value
    ctx.fillStyle = isPositive ? '#00ff41' : '#ff0040'
    ctx.font = '11px JetBrains Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${isPositive ? '+' : ''}${netProfitNum.toFixed(2)} INIT`, width / 2, barY - 8)
  }, [stats.netProfit])

  useEffect(() => {
    drawProfitChart()
    const resizeObserver = new ResizeObserver(drawProfitChart)
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current)
    }
    return () => resizeObserver.disconnect()
  }, [drawProfitChart])

  const netProfitPositive = stats.netProfit >= BigInt(0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Value Locked" value={formatTokenAmount(stats.tvl)} suffix="INIT" variant="amber" size="lg" />
        <StatCard label="Current APY" value={stats.apy.toFixed(2)} suffix="%" variant="green" size="lg" />
        <StatCard label="Net Profit" value={formatTokenAmount(stats.netProfit)} suffix="INIT" variant={netProfitPositive ? 'green' : 'red'} />
        <StatCard label="Depositors" value="--" variant="default" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-glow bg-surface rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Vault P&L (On-Chain)</h3>
          <span className={cn('text-xs font-mono', netProfitPositive ? 'text-green' : 'text-red')}>
            {netProfitPositive ? '+' : ''}{formatTokenAmount(stats.netProfit)} INIT
          </span>
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
              <span className={cn('text-xs font-mono font-semibold', netProfitPositive ? 'text-green' : 'text-red')}>
                {netProfitPositive ? '+' : ''}{formatTokenAmount(stats.netProfit)} INIT
              </span>
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