// ============================================
// Contract Addresses
// ============================================

export const CONTRACT_ADDRESSES = {
  coinFlip: (process.env.NEXT_PUBLIC_COIN_FLIP_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  diceRoll: (process.env.NEXT_PUBLIC_DICE_ROLL_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  crashGame: (process.env.NEXT_PUBLIC_CRASH_GAME_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  houseVault: (process.env.NEXT_PUBLIC_HOUSE_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  leaderboard: (process.env.NEXT_PUBLIC_LEADERBOARD_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  sessionManager: (process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  randomness: (process.env.NEXT_PUBLIC_RANDOMNESS_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
} as const

export const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

// ============================================
// ABIs
// ============================================

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' },
    ],
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
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
] as const

export const COIN_FLIP_ABI = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'choice', type: 'uint8', internalType: 'uint8' },
      { name: 'playerCommitHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: 'betId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveBet',
    inputs: [
      { name: 'betId', type: 'uint256', internalType: 'uint256' },
      { name: 'playerSeed', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimTimeout',
    inputs: [{ name: 'betId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getBet',
    inputs: [{ name: 'betId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CoinFlip.Bet',
        components: [
          { name: 'player', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'feeAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'choice', type: 'uint8', internalType: 'uint8' },
          { name: 'commitId', type: 'uint256', internalType: 'uint256' },
          { name: 'status', type: 'uint8', internalType: 'uint8' },
          { name: 'payout', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PAYOUT_MULTIPLIER_BPS',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'BetPlaced',
    inputs: [
      { name: 'betId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'player', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'choice', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'commitId', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'BetResolved',
    inputs: [
      { name: 'betId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'player', type: 'address', indexed: true, internalType: 'address' },
      { name: 'won', type: 'bool', indexed: false, internalType: 'bool' },
      { name: 'payout', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'result', type: 'uint8', indexed: false, internalType: 'uint8' },
    ],
  },
] as const

export const DICE_ROLL_ABI = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'chosenNumber', type: 'uint256', internalType: 'uint256' },
      { name: 'playerCommitHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: 'betId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveBet',
    inputs: [
      { name: 'betId', type: 'uint256', internalType: 'uint256' },
      { name: 'playerSeed', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimTimeout',
    inputs: [{ name: 'betId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getBet',
    inputs: [{ name: 'betId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct DiceRoll.Bet',
        components: [
          { name: 'player', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'feeAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'chosenNumber', type: 'uint256', internalType: 'uint256' },
          { name: 'commitId', type: 'uint256', internalType: 'uint256' },
          { name: 'status', type: 'uint8', internalType: 'uint8' },
          { name: 'payout', type: 'uint256', internalType: 'uint256' },
          { name: 'rolledNumber', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMultiplierBps',
    inputs: [{ name: 'chosenNumber', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculatePayout',
    inputs: [
      { name: 'betAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'chosenNumber', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'BetPlaced',
    inputs: [
      { name: 'betId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'player', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'chosenNumber', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'commitId', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'BetResolved',
    inputs: [
      { name: 'betId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'player', type: 'address', indexed: true, internalType: 'address' },
      { name: 'won', type: 'bool', indexed: false, internalType: 'bool' },
      { name: 'payout', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'rolledNumber', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
] as const

export const CRASH_GAME_ABI = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      { name: 'roundId', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cashOut',
    inputs: [
      { name: 'roundId', type: 'uint256', internalType: 'uint256' },
      { name: 'multiplierBps', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'currentRoundId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRound',
    inputs: [{ name: 'roundId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CrashGame.Round',
        components: [
          { name: 'roundId', type: 'uint256', internalType: 'uint256' },
          { name: 'status', type: 'uint8', internalType: 'uint8' },
          { name: 'serverCommitHash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'serverSeed', type: 'bytes32', internalType: 'bytes32' },
          { name: 'crashPointBps', type: 'uint256', internalType: 'uint256' },
          { name: 'bettingEndTime', type: 'uint256', internalType: 'uint256' },
          { name: 'startTime', type: 'uint256', internalType: 'uint256' },
          { name: 'totalBets', type: 'uint256', internalType: 'uint256' },
          { name: 'totalPayouts', type: 'uint256', internalType: 'uint256' },
          { name: 'playerCount', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPlayerBet',
    inputs: [
      { name: 'roundId', type: 'uint256', internalType: 'uint256' },
      { name: 'player', type: 'address', internalType: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CrashGame.PlayerBet',
        components: [
          { name: 'player', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'feeAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'cashOutMultiplierBps', type: 'uint256', internalType: 'uint256' },
          { name: 'cashedOut', type: 'bool', internalType: 'bool' },
          { name: 'payout', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'RoundStarted',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'serverCommitHash', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'bettingEndTime', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'BetPlaced',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'player', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'CashedOut',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'player', type: 'address', indexed: true, internalType: 'address' },
      { name: 'multiplierBps', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'payout', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'RoundCrashed',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'crashPointBps', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'serverSeed', type: 'bytes32', indexed: false, internalType: 'bytes32' },
    ],
  },
] as const

export const HOUSE_VAULT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'assets', type: 'uint256', internalType: 'uint256' },
      { name: 'receiver', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'redeem',
    inputs: [
      { name: 'shares', type: 'uint256', internalType: 'uint256' },
      { name: 'receiver', type: 'address', internalType: 'address' },
      { name: 'owner', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'assets', type: 'uint256', internalType: 'uint256' }],
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
    name: 'maxBet',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bankroll',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalPayouts',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalBetsReceived',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'currentEpoch',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getEpochPnL',
    inputs: [{ name: 'epoch', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'int256', internalType: 'int256' }],
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
    name: 'previewRedeem',
    inputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'sender', type: 'address', indexed: true, internalType: 'address' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Withdraw',
    inputs: [
      { name: 'sender', type: 'address', indexed: true, internalType: 'address' },
      { name: 'receiver', type: 'address', indexed: true, internalType: 'address' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
] as const

export const LEADERBOARD_ABI = [
  {
    type: 'function',
    name: 'topByWagered',
    inputs: [{ name: 'n', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: 'players',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: 'stats',
        type: 'tuple[]',
        internalType: 'struct Leaderboard.PlayerStats[]',
        components: [
          { name: 'totalWagered', type: 'uint256', internalType: 'uint256' },
          { name: 'totalWon', type: 'uint256', internalType: 'uint256' },
          { name: 'totalLost', type: 'uint256', internalType: 'uint256' },
          { name: 'biggestWin', type: 'uint256', internalType: 'uint256' },
          { name: 'gamesPlayed', type: 'uint256', internalType: 'uint256' },
          { name: 'gamesWon', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPlayerStats',
    inputs: [{ name: 'player', type: 'address', internalType: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct Leaderboard.PlayerStats',
        components: [
          { name: 'totalWagered', type: 'uint256', internalType: 'uint256' },
          { name: 'totalWon', type: 'uint256', internalType: 'uint256' },
          { name: 'totalLost', type: 'uint256', internalType: 'uint256' },
          { name: 'biggestWin', type: 'uint256', internalType: 'uint256' },
          { name: 'gamesPlayed', type: 'uint256', internalType: 'uint256' },
          { name: 'gamesWon', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNetPnL',
    inputs: [{ name: 'player', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'int256', internalType: 'int256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getWinRate',
    inputs: [{ name: 'player', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalPlayers',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export const SESSION_MANAGER_ABI = [
  {
    type: 'function',
    name: 'createSession',
    inputs: [
      { name: 'delegate', type: 'address', internalType: 'address' },
      { name: 'maxBetAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'spendingLimit', type: 'uint256', internalType: 'uint256' },
      { name: 'expiresAt', type: 'uint256', internalType: 'uint256' },
      { name: 'allowedGames', type: 'address[]', internalType: 'address[]' },
    ],
    outputs: [{ name: 'sessionId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeSession',
    inputs: [{ name: 'sessionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isSessionValid',
    inputs: [{ name: 'sessionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserSessions',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256[]', internalType: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'remainingLimit',
    inputs: [{ name: 'sessionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sessions',
    inputs: [{ name: 'sessionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct SessionManager.Session',
        components: [
          { name: 'owner', type: 'address', internalType: 'address' },
          { name: 'delegate', type: 'address', internalType: 'address' },
          { name: 'maxBetAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'expiresAt', type: 'uint256', internalType: 'uint256' },
          { name: 'totalSpent', type: 'uint256', internalType: 'uint256' },
          { name: 'spendingLimit', type: 'uint256', internalType: 'uint256' },
          { name: 'revoked', type: 'bool', internalType: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'SessionCreated',
    inputs: [
      { name: 'sessionId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'delegate', type: 'address', indexed: true, internalType: 'address' },
      { name: 'maxBetAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'spendingLimit', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'expiresAt', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
] as const

export const RANDOMNESS_ABI = [
  {
    type: 'function',
    name: 'getCommitStatus',
    inputs: [{ name: 'commitId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isTimedOut',
    inputs: [{ name: 'commitId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'CommitmentRevealed',
    inputs: [
      { name: 'commitId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'serverSeed', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'resultHash', type: 'bytes32', indexed: false, internalType: 'bytes32' },
    ],
  },
] as const
