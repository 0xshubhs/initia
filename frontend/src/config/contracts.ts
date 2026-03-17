import { type Abi } from 'viem'

// ============================================
// Contract Addresses
// ============================================

export const CONTRACT_ADDRESSES = {
  coinFlip: (process.env.NEXT_PUBLIC_COIN_FLIP_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  diceRoll: (process.env.NEXT_PUBLIC_DICE_ROLL_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  crashGame: (process.env.NEXT_PUBLIC_CRASH_GAME_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  houseVault: (process.env.NEXT_PUBLIC_HOUSE_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  sessionBetting: (process.env.NEXT_PUBLIC_SESSION_BETTING_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
} as const

// ============================================
// ABIs (matching the Solidity contracts)
// ============================================

export const COIN_FLIP_ABI: Abi = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [{ name: 'chooseHeads', type: 'bool', internalType: 'bool' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getGameResult',
    inputs: [{ name: 'gameId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'player', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'chooseHeads', type: 'bool', internalType: 'bool' },
      { name: 'result', type: 'bool', internalType: 'bool' },
      { name: 'won', type: 'bool', internalType: 'bool' },
      { name: 'payout', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRecentGames',
    inputs: [{ name: 'count', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct CoinFlip.Game[]',
        components: [
          { name: 'player', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'chooseHeads', type: 'bool', internalType: 'bool' },
          { name: 'result', type: 'bool', internalType: 'bool' },
          { name: 'won', type: 'bool', internalType: 'bool' },
          { name: 'payout', type: 'uint256', internalType: 'uint256' },
          { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'BetPlaced',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'player', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'chooseHeads', type: 'bool', indexed: false, internalType: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'BetResolved',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'player', type: 'address', indexed: true, internalType: 'address' },
      { name: 'won', type: 'bool', indexed: false, internalType: 'bool' },
      { name: 'payout', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
]

export const DICE_ROLL_ABI: Abi = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      { name: 'target', type: 'uint8', internalType: 'uint8' },
      { name: 'rollUnder', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getGameResult',
    inputs: [{ name: 'gameId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'player', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'target', type: 'uint8', internalType: 'uint8' },
      { name: 'rollUnder', type: 'bool', internalType: 'bool' },
      { name: 'rolled', type: 'uint8', internalType: 'uint8' },
      { name: 'won', type: 'bool', internalType: 'bool' },
      { name: 'payout', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'DiceRolled',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'player', type: 'address', indexed: true, internalType: 'uint256' },
      { name: 'target', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'rolled', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'won', type: 'bool', indexed: false, internalType: 'bool' },
      { name: 'payout', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
]

export const CRASH_GAME_ABI: Abi = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'cashOut',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setAutoCashOut',
    inputs: [{ name: 'multiplier', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'RoundStarted',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'RoundCrashed',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'crashPoint', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'PlayerCashedOut',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'player', type: 'address', indexed: true, internalType: 'address' },
      { name: 'multiplier', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'payout', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
]

export const HOUSE_VAULT_ABI: Abi = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'totalAssets',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'previewDeposit',
    inputs: [{ name: 'assets', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'previewWithdraw',
    inputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'depositor', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Withdraw',
    inputs: [
      { name: 'withdrawer', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
]
