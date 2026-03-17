'use client'

import { motion } from 'framer-motion'
import VaultDeposit from '@/components/vault/VaultDeposit'
import VaultStats from '@/components/vault/VaultStats'

export default function VaultPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-mono text-text mb-2">
          <span className="text-amber crt-glow">$</span> House Vault
        </h1>
        <p className="text-sm text-text-secondary font-mono">Deposit into the bankroll. Earn yield from the house edge.</p>
      </div>
      <VaultStats />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VaultDeposit />
        <div className="space-y-6">
          <div className="card-glow bg-surface rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">How the Vault Works</h3>
            <div className="space-y-4">
              {[
                { title: 'Deposit & Earn', desc: 'Deposit INIT to provide bankroll for games. You receive ibINIT shares representing your portion of the vault.' },
                { title: 'House Edge Revenue', desc: 'Every game has a built-in house edge (1-3%). Over time, the vault earns from this mathematical advantage.' },
                { title: 'Risk & Reward', desc: 'Short-term losses are possible when players win big. Long-term, the house edge ensures positive expected value.' },
                { title: 'Withdraw Anytime', desc: 'Burn your ibINIT shares to withdraw your proportional share of the vault balance.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-6 h-6 rounded bg-amber/10 border border-amber/20 flex-shrink-0 flex items-center justify-center">
                    <span className="text-xs text-amber font-mono font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <h4 className="text-sm text-text font-medium mb-1">{item.title}</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card-glow bg-surface rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">FAQ</h3>
            <div className="space-y-3">
              {[
                { q: 'What is ibINIT?', a: 'ibINIT (InitiaBet INIT) is a share token representing your deposit in the vault. As the vault earns revenue, each ibINIT becomes worth more INIT.' },
                { q: 'Can I lose money?', a: 'Yes. If players have a lucky streak, the vault balance can temporarily decrease. However, the mathematical house edge ensures long-term profitability.' },
                { q: 'Is there a lock-up period?', a: 'No. You can withdraw your funds at any time by burning your ibINIT shares.' },
              ].map((item, i) => (
                <div key={i} className="bg-bg rounded-lg p-3">
                  <p className="text-xs text-amber font-mono font-semibold mb-1">{item.q}</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
