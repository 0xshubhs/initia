'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { shortenAddress } from '@/lib/utils'

interface ConnectButtonProps {
  compact?: boolean
}

export default function ConnectButton({ compact = false }: ConnectButtonProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleConnect = async () => {
    setIsConnecting(true)
    await new Promise(r => setTimeout(r, 1000))
    setAddress('0x7a16fF8270133F063aAb6C9977183D9e72835428')
    setUsername('player.init')
    setIsConnected(true)
    setIsConnecting(false)
  }

  const handleDisconnect = () => {
    setAddress(null)
    setUsername(null)
    setIsConnected(false)
    setShowMenu(false)
  }

  if (!isConnected) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleConnect}
        disabled={isConnecting}
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
          {username || shortenAddress(address || '')}
        </span>
      </button>
    )
  }

  return (
    <div className="relative">
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
          {username && (
            <p className="text-amber text-sm font-semibold crt-glow">{username}</p>
          )}
          <p className="text-text-secondary text-xs font-mono">
            {shortenAddress(address || '')}
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
            <p className="text-sm text-amber font-mono">{username || shortenAddress(address || '')}</p>
          </div>

          <button
            onClick={() => {
              setShowMenu(false)
            }}
            className="w-full px-4 py-2 text-left text-sm text-text
                       hover:bg-surface-hover transition-colors"
          >
            Bridge Assets
          </button>

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
