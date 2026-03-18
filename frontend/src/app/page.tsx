'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import StatCard from '@/components/shared/StatCard'

const GAMES_STATIC = [
  {
    path: '/coinflip',
    name: 'Coin Flip',
    description: 'Classic 50/50. Heads or tails.',
    icon: 'H|T',
    houseEdge: '2%',
    maxPayout: '1.96x',
  },
  {
    path: '/dice',
    name: 'Dice Roll',
    description: 'Set your odds. Roll the dice.',
    icon: 'D6',
    houseEdge: '1%',
    maxPayout: '99x',
  },
  {
    path: '/crash',
    name: 'Crash',
    description: 'Ride the curve. Cash out in time.',
    icon: '/\\',
    houseEdge: '3%',
    maxPayout: '1000x',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function HomePage() {
  const [liveData, setLiveData] = useState<{ liveBets: number; volume: string }[]>([])

  useEffect(() => {
    setLiveData(GAMES_STATIC.map(() => ({
      liveBets: Math.floor(Math.random() * 200) + 50,
      volume: `${(Math.random() * 500 + 100).toFixed(0)}`,
    })))
  }, [])

  const GAMES = GAMES_STATIC.map((game, i) => ({
    ...game,
    liveBets: liveData[i]?.liveBets ?? '--',
    volume: liveData[i]?.volume ?? '--',
  }))

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-16">
      <motion.section variants={itemVariants} className="text-center py-12 sm:py-20">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
          <p className="text-text-secondary text-sm font-mono mb-4">
            <span className="text-amber">$</span> ./initiabet --start
          </p>
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black font-mono text-amber crt-glow-strong mb-4 tracking-tight">
            INITIA<span className="text-amber-light">BET</span>
          </h1>
          <p className="text-lg sm:text-xl text-text-secondary font-mono max-w-2xl mx-auto terminal-cursor">
            Provably Fair. 100ms Blocks. Your House, Your Rules
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 mt-10">
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-amber crt-glow">1,250</p>
              <p className="text-xs text-text-secondary uppercase tracking-wider mt-1">INIT Wagered</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-text">347</p>
              <p className="text-xs text-text-secondary uppercase tracking-wider mt-1">Total Bets</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-green">47</p>
              <p className="text-xs text-text-secondary uppercase tracking-wider mt-1">Players</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-text">~100ms</p>
              <p className="text-xs text-text-secondary uppercase tracking-wider mt-1">Block Time</p>
            </div>
          </div>
        </motion.div>
      </motion.section>

      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold font-mono text-text"><span className="text-amber">&gt;</span> Games</h2>
          <span className="text-xs text-text-dim font-mono">3 available</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {GAMES.map((game) => (
            <motion.div key={game.path} variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Link href={game.path} className="block card-glow bg-surface rounded-xl p-6 h-full group transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,176,0,0.08)]">
                <div className="w-16 h-16 rounded-xl bg-amber/8 border border-amber/20 flex items-center justify-center mb-5 group-hover:bg-amber/15 group-hover:border-amber/40 transition-all duration-300">
                  <span className="text-2xl font-bold font-mono text-amber crt-glow">{game.icon}</span>
                </div>
                <h3 className="text-xl font-bold font-mono text-text mb-2 group-hover:text-amber transition-colors duration-300">{game.name}</h3>
                <p className="text-sm text-text-secondary mb-5">{game.description}</p>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                  <div><p className="text-[10px] text-text-dim uppercase tracking-wider">House Edge</p><p className="text-sm text-text font-mono">{game.houseEdge}</p></div>
                  <div><p className="text-[10px] text-text-dim uppercase tracking-wider">Max Payout</p><p className="text-sm text-amber font-mono">{game.maxPayout}</p></div>
                  <div><p className="text-[10px] text-text-dim uppercase tracking-wider">Live Bets</p><p className="text-sm text-text font-mono">{game.liveBets}</p></div>
                  <div><p className="text-[10px] text-text-dim uppercase tracking-wider">Volume (INIT)</p><p className="text-sm text-text font-mono">{game.volume}</p></div>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-amber font-mono opacity-0 group-hover:opacity-100 transition-opacity">Play now</span>
                  <svg className="w-5 h-5 text-amber opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold font-mono text-text"><span className="text-amber">&gt;</span> House Vault</h2>
          <Link href="/vault" className="text-xs text-amber hover:text-amber-light font-mono transition-colors">View details &rarr;</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="TVL" value="1,250" suffix="INIT" variant="amber" />
          <StatCard label="APY" value="12.5" suffix="%" variant="green" change={0.5} />
          <StatCard label="Net Profit" value="58" suffix="INIT" variant="green" />
          <StatCard label="Depositors" value="47" variant="default" />
        </div>
      </motion.section>

      <motion.section variants={itemVariants}>
        <h2 className="text-lg font-bold font-mono text-text mb-6"><span className="text-amber">&gt;</span> How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: '01', title: 'Connect', desc: 'Link your wallet via InterwovenKit. Get your .init username.' },
            { step: '02', title: 'Bridge', desc: 'Move INIT or tokens from any chain via the Interwoven Bridge.' },
            { step: '03', title: 'Session Key', desc: 'Enable auto-sign for seamless betting. No popups per bet.' },
            { step: '04', title: 'Play', desc: 'Every bet is on-chain. Every outcome is provably fair.' },
          ].map(item => (
            <motion.div key={item.step} variants={itemVariants} className="card-glow bg-surface rounded-xl p-5 space-y-3">
              <span className="text-3xl font-black font-mono text-amber/20">{item.step}</span>
              <h3 className="text-sm font-bold font-mono text-text">{item.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="text-center py-8">
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-surface border border-border">
          <span className="text-xs text-text-secondary font-mono">Powered by</span>
          <span className="text-sm font-bold text-amber crt-glow">Initia</span>
          <span className="text-xs text-text-dim font-mono">|</span>
          <span className="text-xs text-text-secondary font-mono">INITIATE Hackathon 2026</span>
        </div>
      </motion.section>
    </motion.div>
  )
}
