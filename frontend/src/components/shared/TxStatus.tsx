'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { TxState } from '@/types'
import { shortenAddress } from '@/lib/utils'

interface TxStatusProps {
  state: TxState
  hash?: string | null
  error?: string
}

const stateConfig: Record<TxState, { label: string; color: string; icon: string }> = {
  idle: { label: '', color: '', icon: '' },
  confirming: { label: 'Confirm in wallet...', color: 'text-amber', icon: '>' },
  pending: { label: 'Processing...', color: 'text-amber', icon: '...' },
  success: { label: 'Confirmed', color: 'text-green', icon: '+' },
  error: { label: 'Failed', color: 'text-red', icon: 'x' },
}

export default function TxStatus({ state, hash, error }: TxStatusProps) {
  if (state === 'idle') return null

  const config = stateConfig[state]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border
          ${state === 'confirming' || state === 'pending'
            ? 'bg-amber-subtle border-amber-dim/30'
            : state === 'success'
            ? 'bg-green/5 border-green-dim/30'
            : 'bg-red/5 border-red-dim/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {(state === 'confirming' || state === 'pending') && (
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-amber font-mono text-sm"
              >
                [{config.icon}]
              </motion.span>
            )}
            {state === 'success' && (
              <span className="text-green font-mono text-sm">[{config.icon}]</span>
            )}
            {state === 'error' && (
              <span className="text-red font-mono text-sm">[{config.icon}]</span>
            )}
          </div>

          <span className={`text-sm font-mono ${config.color}`}>
            {error || config.label}
          </span>

          {hash && state === 'success' && (
            <a
              href={`https://explorer.testnet.initia.xyz/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-text-secondary hover:text-amber transition-colors font-mono"
            >
              tx:{shortenAddress(hash, 6)}
            </a>
          )}

          {state === 'pending' && (
            <motion.span
              className="ml-auto text-amber-dim font-mono text-xs"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              awaiting block...
            </motion.span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
