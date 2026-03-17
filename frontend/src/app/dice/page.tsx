'use client'

import { motion } from 'framer-motion'
import DiceRoll from '@/components/games/DiceRoll'

export default function DiceRollPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-mono text-text mb-2">
          <span className="text-amber crt-glow">$</span> Dice Roll
        </h1>
        <p className="text-sm text-text-secondary font-mono">Set your target. Choose your odds. Up to 99x payout.</p>
      </div>
      <DiceRoll />
    </motion.div>
  )
}
