'use client'

import { motion } from 'framer-motion'
import { useSessionKey } from '@/hooks/useSessionKey'
import { formatTokenAmount } from '@/lib/utils'

interface SessionKeyManagerProps {
  compact?: boolean
}

export default function SessionKeyManager({ compact = false }: SessionKeyManagerProps) {
  const {
    sessionKey,
    isCreating,
    isRevoking,
    isActive,
    createSession,
    revokeSession,
    timeRemaining,
  } = useSessionKey()

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green animate-pulse' : 'bg-text-dim'}`} />
        <span className="text-xs font-mono text-text-secondary">
          {isActive ? 'Auto-sign ON' : 'Auto-sign OFF'}
        </span>
        {!isActive && (
          <button
            onClick={() => createSession()}
            disabled={isCreating}
            className="text-xs text-amber hover:text-amber-light transition-colors"
          >
            {isCreating ? '...' : 'Enable'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="card-glow bg-surface rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Session Key
        </h3>
        <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-mono
          ${isActive
            ? 'bg-green/10 text-green border border-green/20'
            : 'bg-text-dim/10 text-text-dim border border-text-dim/20'
          }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green animate-pulse' : 'bg-text-dim'}`} />
          {isActive ? 'ACTIVE' : 'INACTIVE'}
        </div>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed">
        Session keys allow automatic transaction signing for bets, eliminating wallet popups.
        Set a time limit and max spending amount for security.
      </p>

      {isActive && sessionKey ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg rounded-lg p-3">
              <p className="text-xs text-text-secondary mb-1">Time Remaining</p>
              <p className="text-sm text-amber font-mono">
                {timeRemaining ? formatTime(timeRemaining) : '--'}
              </p>
            </div>
            <div className="bg-bg rounded-lg p-3">
              <p className="text-xs text-text-secondary mb-1">Max Amount</p>
              <p className="text-sm text-amber font-mono">
                {formatTokenAmount(sessionKey.maxAmount)} INIT
              </p>
            </div>
          </div>

          <div className="bg-bg rounded-lg p-3">
            <p className="text-xs text-text-secondary mb-1">Allowed Contracts</p>
            <p className="text-xs text-text-dim font-mono break-all">
              {sessionKey.allowedContracts.length} game contracts
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={revokeSession}
            disabled={isRevoking}
            className="w-full py-2.5 rounded-lg text-sm font-mono
                       bg-red/10 text-red border border-red/20
                       hover:bg-red/20
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            {isRevoking ? 'Revoking...' : 'Revoke Session Key'}
          </motion.button>
        </div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => createSession()}
          disabled={isCreating}
          className="w-full py-3 rounded-lg text-sm font-semibold font-mono
                     bg-amber text-bg
                     hover:bg-amber-light
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-200"
        >
          {isCreating ? (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              Creating Session...
            </motion.span>
          ) : (
            'Enable Auto-Sign (24h)'
          )}
        </motion.button>
      )}
    </div>
  )
}
