import { defineChain } from 'viem'

export const initiaTestnet = defineChain({
  id: 7701,
  name: 'Initia Testnet MiniEVM',
  nativeCurrency: {
    name: 'INIT',
    symbol: 'INIT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL ?? 'https://rpc.testnet.initia.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Initia Explorer',
      url: 'https://explorer.testnet.initia.xyz',
    },
  },
  testnet: true,
})

export const NETWORK_TYPE = (process.env.NEXT_PUBLIC_NETWORK_TYPE ?? 'testnet') as 'testnet' | 'mainnet'
