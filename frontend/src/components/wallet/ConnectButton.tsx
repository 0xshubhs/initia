'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { shortenAddress, formatTokenAmount } from '@/lib/utils'

interface ConnectButtonProps {
  compact?: boolean
}

export default function ConnectButton({ compact = false }: ConnectButtonProps) {
  const { address, isConnected, isConnecting } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balanceData } = useBalance({ address })

  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setShowMenu(false)
    }
  }, [])

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setShowMenu(false)
  }, [])

  useEffect(() => {
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [showMenu, handleClickOutside, handleEscape])

  const handleConnect = () => {
    connect({ connector: injected() })
  }

  const handleDisconnect = () => {
    disconnect()
    setShowMenu(false)
  }

  const displayName = address ? shortenAddress(address) : ''
  const formattedBalance = balanceData
    ? formatTokenAmount(balanceData.value, balanceData.decimals)
    : '0'
  const balanceSymbol = balanceData?.symbol ?? 'INIT'

  if (!isConnected) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleConnect}
        disabled={isConnecting}
        aria-label={isConnecting ? 'Connecting wallet' : 'Connect wallet'}
        className="btn-glow relative px-5 py-2.5 rounded-lg font-mono text-sm font-semibold
                   bg-amber text-bg
                   hover:bg-amber-light
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors duration-200"
      >
        {isConnecting ? (
          <span className="flex items-center gap-2">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              Connecting...
            </motion.span>
          </span>
        ) : (
          'Connect Wallet'
        )}
      </motion.button>
    )
  }

  if (compact) {
    return (
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg
                   bg-surface border border-border
                   hover:border-amber-dim
                   transition-all duration-200"
      >
        <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
        <span className="text-amber text-sm font-mono">
          {displayName}
        </span>
      </button>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg
                   bg-surface border border-border
                   hover:border-amber-dim
                   transition-all duration-200"
      >
        <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
        <div className="text-left">
          <p className="text-amber text-sm font-semibold crt-glow">{displayName}</p>
          <p className="text-text-secondary text-xs font-mono">
            {formattedBalance} {balanceSymbol}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-text-secondary transition-transform ${showMenu ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </motion.button>

      {showMenu && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute right-0 top-full mt-2 w-56 py-2
                     bg-surface border border-border rounded-lg shadow-lg
                     z-50"
        >
          <div className="px-4 py-2 border-b border-border">
            <p className="text-xs text-text-secondary">Connected as</p>
            <p className="text-sm text-amber font-mono">{displayName}</p>
          </div>

          <div className="px-4 py-2 border-b border-border">
            <p className="text-xs text-text-secondary">Balance</p>
            <p className="text-sm text-text font-mono">{formattedBalance} {balanceSymbol}</p>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(address || '')
              setShowMenu(false)
            }}
            className="w-full px-4 py-2 text-left text-sm text-text
                       hover:bg-surface-hover transition-colors"
          >
            Copy Address
          </button>

          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={handleDisconnect}
              className="w-full px-4 py-2 text-left text-sm text-red
                         hover:bg-surface-hover transition-colors"
            >
              Disconnect
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
