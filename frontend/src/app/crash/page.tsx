'use client'

import { motion } from 'framer-motion'
import CrashGame from '@/components/games/CrashGame'

export default function CrashGamePage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-mono text-text mb-2">
          <span className="text-amber crt-glow">$</span> Crash
        </h1>
        <p className="text-sm text-text-secondary font-mono">Watch the multiplier rise. Cash out before it crashes. Up to 1000x.</p>
      </div>
      <CrashGame />
    </motion.div>
  )
}
