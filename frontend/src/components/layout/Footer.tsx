export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-amber/10 border border-amber/30 flex items-center justify-center">
                <span className="text-amber font-bold text-xs">iB</span>
              </div>
              <span className="text-sm font-bold text-amber crt-glow">INITIABET</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed max-w-xs">
              Provably fair on-chain gaming casino built on Initia.
              Every bet is a transaction. Every outcome is verifiable.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider text-text-secondary font-semibold">Resources</h4>
            <div className="space-y-2">
              <a href="https://docs.initia.xyz" target="_blank" rel="noopener noreferrer"
                 className="block text-xs text-text-dim hover:text-amber transition-colors">
                Initia Docs
              </a>
              <a href="https://explorer.testnet.initia.xyz" target="_blank" rel="noopener noreferrer"
                 className="block text-xs text-text-dim hover:text-amber transition-colors">
                Block Explorer
              </a>
              <a href="https://bridge.testnet.initia.xyz" target="_blank" rel="noopener noreferrer"
                 className="block text-xs text-text-dim hover:text-amber transition-colors">
                Interwoven Bridge
              </a>
            </div>
          </div>

          {/* Stats / Info */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider text-text-secondary font-semibold">Network</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                <span className="text-xs text-text-dim">Initia Testnet</span>
              </div>
              <p className="text-xs text-text-dim font-mono">
                Block time: ~100ms
              </p>
              <p className="text-xs text-text-dim font-mono">
                House edge: 1-3%
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-dim">
            Built for the INITIATE Hackathon 2026
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-dim">Powered by</span>
            <a
              href="https://initia.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber hover:text-amber-light transition-colors font-semibold"
            >
              Initia
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
