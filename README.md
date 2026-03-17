# InitiaBet - Provably Fair On-Chain Casino

> **Built for [INITIATE: The Initia Hackathon](https://dorahacks.io/hackathon/initiate) | Gaming Track**

## What is InitiaBet?

InitiaBet is a provably fair on-chain gaming casino deployed as its own Initia EVM appchain. Every game uses commit-reveal randomness verifiable on-chain. Every bet is a transaction. Every transaction is revenue you own.

### Games

| Game | How It Works | House Edge |
|------|-------------|------------|
| **CoinFlip** | Pick heads or tails. Win = 1.96x payout | 2% |
| **DiceRoll** | Pick a number 1-100, roll under to win. Higher risk = higher reward | 2% |
| **CrashGame** | Multiplier rises from 1.00x. Cash out before it crashes | ~2% |

### Why Initia?

- **100ms blocks** - Real-time gaming experience impossible on slower chains
- **Own sequencer revenue** - Every bet = transaction fee revenue for the operator
- **Session keys** - Players bet without approving every single transaction
- **Interwoven Bridge** - Deposit from any chain in the Initia ecosystem
- **.init usernames** - Player identity and leaderboard profiles

## Architecture

```
┌─────────────────────────────────────────────────┐
│           InitiaBet EVM Minitia                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ CoinFlip │  │ DiceRoll │  │  CrashGame   │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       └──────────────┼───────────────┘          │
│                      ▼                           │
│  ┌──────────────────────────────────────────┐   │
│  │  HouseVault (ERC4626-style bankroll)     │   │
│  │  SessionManager (auto-sign bets)         │   │
│  │  RandomnessProvider (commit-reveal)      │   │
│  │  FeeCollector + Leaderboard              │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Frontend: React + InterwovenKit                │
│  Bridge + .init names + Session Keys            │
└─────────────────────────────────────────────────┘
```

## Initia-Native Features Used

- **Auto-signing / Session UX** - Create session keys for frictionless betting
- **Interwoven Bridge** - One-click deposits from Initia L1 or any Minitia
- **Initia Usernames (.init)** - Player profiles and leaderboard identity

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24, OpenZeppelin, Foundry |
| Frontend | React 19, TypeScript, Vite, TailwindCSS |
| Wallet | @initia/interwovenkit-react |
| Appchain | MiniEVM (Initia Interwoven Stack) |
| Design | Amber CRT terminal aesthetic |

## Getting Started

### Prerequisites

- Docker Desktop (running)
- Go 1.22+
- Node.js 20+
- pnpm
- Foundry (forge, cast)
- weave CLI

### Setup Appchain

```bash
# Initialize your Initia EVM appchain
weave init

# Start infrastructure
weave opinit init executor
weave relayer init
weave start -d
```

### Deploy Contracts

```bash
cd contracts
forge install
forge build
forge test
forge script script/Deploy.s.sol --broadcast --rpc-url <YOUR_MINITIA_RPC>
```

### Run Frontend

```bash
cd frontend
pnpm install
pnpm dev
# Open http://localhost:5173
```

## Revenue Model

| Source | Mechanism |
|--------|-----------|
| House Edge | 2% on every bet across all games |
| Sequencer Fees | 100% of gas fees from every transaction |
| Platform Fee | 0.5% of volume to protocol treasury |

## Security

- **Provable Fairness** - Commit-reveal randomness, all results verifiable on-chain
- **ReentrancyGuard** - On all payout functions
- **Max Bet Limits** - 2% of bankroll per bet prevents drain attacks
- **Timeout Protection** - If house doesn't reveal, player wins by default
- **Session Key Scoping** - Limited by amount, time, and allowed contracts

## Team

Built with Claude Code for INITIATE: The Initia Hackathon (Season 1).

## License

MIT
