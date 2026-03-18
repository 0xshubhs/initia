'use client'

import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { initiaTestnet } from './chains'

export const wagmiConfig = createConfig({
  chains: [initiaTestnet],
  connectors: [injected()],
  transports: {
    [initiaTestnet.id]: http(),
  },
  ssr: true,
})
