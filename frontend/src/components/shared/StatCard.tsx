'use client'

import { motion } from 'framer-motion'

interface StatCardProps {
  label: string
  value: string
  suffix?: string
  prefix?: string
  change?: number
  variant?: 'default' | 'amber' | 'green' | 'red'
  size?: 'sm' | 'md' | 'lg'
}

export default function StatCard({
  label,
  value,
  suffix,
  prefix,
  change,
  variant = 'default',
  size = 'md',
}: StatCardProps) {
  const colorClasses = {
    default: 'text-text',
    amber: 'text-amber crt-glow',
    green: 'text-green',
    red: 'text-red',
  }

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-glow bg-surface rounded-xl p-4 space-y-1"
    >
      <p className="text-xs uppercase tracking-wider text-text-secondary">
        {label}
      </p>
      <p className={`font-bold font-mono ${sizeClasses[size]} ${colorClasses[variant]}`}>
        {prefix}
        {value}
        {suffix && <span className="text-text-secondary text-sm ml-1">{suffix}</span>}
      </p>
      {change !== undefined && (
        <p className={`text-xs font-mono ${change >= 0 ? 'text-green' : 'text-red'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </p>
      )}
    </motion.div>
  )
}
