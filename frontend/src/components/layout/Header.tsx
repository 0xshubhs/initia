'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import ConnectButton from '@/components/wallet/ConnectButton'
import BridgeButton from '@/components/wallet/BridgeButton'

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/coinflip', label: 'Coin Flip' },
  { path: '/dice', label: 'Dice Roll' },
  { path: '/crash', label: 'Crash' },
  { path: '/vault', label: 'Vault' },
  { path: '/leaderboard', label: 'Leaderboard' },
]

export default function Header() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-amber/10 border border-amber/30 flex items-center justify-center group-hover:bg-amber/20 transition-colors">
              <span className="text-amber font-bold text-sm crt-glow">iB</span>
            </div>
            <span className="text-lg font-bold text-amber crt-glow hidden sm:block">
              INITIA<span className="text-amber-light">BET</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            {NAV_ITEMS.map(item => {
              const isActive = pathname === item.path
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`relative px-3 py-2 text-sm font-mono rounded-md transition-colors duration-200 ${isActive ? 'text-amber' : 'text-text-secondary hover:text-text'}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-amber/8 border border-amber/20 rounded-md"
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <BridgeButton variant="compact" />
            </div>
            <ConnectButton />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 text-text-secondary hover:text-text transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-border py-3 space-y-1"
          >
            {NAV_ITEMS.map(item => {
              const isActive = pathname === item.path
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 text-sm font-mono rounded-md transition-colors duration-200 ${isActive ? 'text-amber bg-amber/8' : 'text-text-secondary hover:text-text hover:bg-surface'}`}
                >
                  {item.label}
                </Link>
              )
            })}
            <div className="pt-2 border-t border-border">
              <BridgeButton variant="compact" />
            </div>
          </motion.nav>
        )}
      </div>
    </header>
  )
}
