'use client'

import { motion } from 'framer-motion'

interface BridgeButtonProps {
  variant?: 'default' | 'compact'
}

export default function BridgeButton({ variant = 'default' }: BridgeButtonProps) {
  const handleOpenBridge = () => {
    window.open('https://bridge.testnet.initia.xyz', '_blank')
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleOpenBridge}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs
                   text-text-secondary border border-border
                   hover:border-amber-dim hover:text-amber
                   transition-all duration-200"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        Bridge
      </button>
    )
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleOpenBridge}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg
                 bg-surface border border-border text-text
                 hover:border-amber-dim hover:text-amber
                 transition-all duration-200"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
      <span className="text-sm font-mono">Bridge Assets</span>
    </motion.button>
  )
}
