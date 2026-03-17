# INITIATE Hackathon - Technical Architecture

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       INITIA L1 (Cosmos SDK + CometBFT)             │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Staking  │  │   DEX    │  │  Slinky  │  │  OPHost (Bridge)   │  │
│  │ + VIP    │  │ Module   │  │  Oracle  │  │  + Fraud Proofs    │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────────┘  │
│                                                                     │
│              ┌──────────────────────────────┐                       │
│              │     IBC Protocol Router      │                       │
│              └──────┬──────────┬────────────┘                       │
└─────────────────────┼──────────┼────────────────────────────────────┘
                      │          │
         ┌────────────┘          └─────────────┐
         │                                     │
         ▼                                     ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│   YOUR EVM MINITIA (L2)     │  │   OTHER MINITIAS (L2s)      │
│                             │  │                             │
│  ┌───────────────────────┐  │  │  Move / Wasm / EVM          │
│  │  YOUR SOLIDITY DAPP   │  │  │  Contracts                  │
│  │                       │  │  │                             │
│  │  ┌─────────────────┐  │  │  └─────────────────────────────┘
│  │  │ Smart Contracts │  │  │
│  │  └────────┬────────┘  │  │
│  │           │           │  │
│  │  ┌────────▼────────┐  │  │
│  │  │   Precompiles   │  │  │
│  │  │ Slinky │ IBC    │  │  │
│  │  │ Cosmos │ Bank   │  │  │
│  │  └─────────────────┘  │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  InterwovenKit        │  │
│  │  React Frontend       │  │
│  │  (.init names, bridge,│  │
│  │   session keys)       │  │
│  └───────────────────────┘  │
│                             │
│  Block: 100ms | TPS: 10K+  │
│  Revenue: YOU keep 100%    │
└─────────────────────────────┘
```

---

## Interwoven Stack (How Your Appchain Connects to L1)

```
┌─────────────────────────────────────────────────┐
│              Interwoven Stack                    │
│                                                  │
│   L1 Side              Off-Chain          L2 Side│
│  ┌────────┐         ┌───────────┐      ┌───────┐│
│  │OPHost  │◄────────│ OPinit    │─────►│OPChild││
│  │        │         │ Bots      │      │       ││
│  │Verifies│         │           │      │Submit ││
│  │state   │         │- Executor │      │batches││
│  │commits │         │- Challngr │      │       ││
│  └────────┘         └───────────┘      └───────┘│
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │           IBC Relayer                         ││
│  │  Relays packets between L1 <-> L2             ││
│  │  Enables token transfers + contract calls     ││
│  └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

| Component | Where | Role |
|-----------|-------|------|
| **OPHost** | Initia L1 | Accepts state commitments, manages fraud proofs |
| **OPChild** | Your Minitia | Submits state batches to L1 |
| **OPinit Executor** | Off-chain | Bridge operations + data submission |
| **IBC Relayer** | Off-chain | Cross-chain token & message relay |
| **Gas Station** | L1 account | Funds your rollup infrastructure |

---

## Frontend Architecture (InterwovenKit)

**MANDATORY: Must use `@initia/interwovenkit-react`**

```
┌────────────────────────────────────────────────────────┐
│                   React App (Vite)                      │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │          <InterwovenKitProvider />                 │  │
│  │                                                    │  │
│  │  Provides:                                         │  │
│  │  ├── Wallet connection (Initia + EVM wallets)     │  │
│  │  ├── Transaction signing                           │  │
│  │  ├── Interwoven Bridge UI                         │  │
│  │  ├── .init username resolution                    │  │
│  │  └── Session key management (auto-signing)        │  │
│  │                                                    │  │
│  │  ┌────────────────────────────────────────────┐   │  │
│  │  │         useInterwovenKit() hook            │   │  │
│  │  │                                             │   │  │
│  │  │  Returns:                                   │   │  │
│  │  │  - wallet state (address, balance, .init)   │   │  │
│  │  │  - bridge functions                         │   │  │
│  │  │  - tx signing functions                     │   │  │
│  │  │  - session management                       │   │  │
│  │  └────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Dependencies (included with InterwovenKit):            │
│  ├── Jotai (state management)                           │
│  ├── TanStack Query (server state)                      │
│  ├── CosmJS (Cosmos interaction)                        │
│  ├── Wagmi (EVM wallet compat)                          │
│  ├── Radix UI (accessible components)                   │
│  └── React Spring (animations)                          │
└────────────────────────────────────────────────────────┘
```

### InterwovenKit Setup

```tsx
// App.tsx
import { InterwovenKitProvider } from '@initia/interwovenkit-react'

function App() {
  return (
    <InterwovenKitProvider
      networkType="testnet"  // or "mainnet"
    >
      <YourApp />
    </InterwovenKitProvider>
  )
}
```

```tsx
// Component.tsx
import { useInterwovenKit } from '@initia/interwovenkit-react'

function Dashboard() {
  const { address, username, openBridge, signTx } = useInterwovenKit()

  return (
    <div>
      <p>Welcome, {username || address}</p>
      <button onClick={openBridge}>Bridge Assets</button>
    </div>
  )
}
```

---

## Smart Contract Architecture

### Token Flow (Unified ERC20)

```
┌──────────────────────────────────────────────────────────┐
│                  ALL Tokens = ERC20                        │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Native INIT │  │  IBC Tokens  │  │  Your ERC20s   │  │
│  │ (gas token) │  │  (USDC, etc) │  │  (app tokens)  │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                │                   │            │
│         └────────────────┼───────────────────┘            │
│                          │                                │
│                 ┌────────▼─────────┐                      │
│                 │  Cosmos Bank ==   │                      │
│                 │  ERC20 Interface  │                      │
│                 │                   │                      │
│                 │  balanceOf()      │                      │
│                 │  transfer()       │                      │
│                 │  approve()        │                      │
│                 │  transferFrom()   │                      │
│                 └──────────────────┘                      │
│                                                           │
│  Key: No wrapping. No conversion. balanceOf() works       │
│  the same for INIT, IBC USDC, and your custom tokens.     │
└──────────────────────────────────────────────────────────┘
```

### Cosmos Precompile Interfaces

```solidity
// ============================================
// COSMOS PRECOMPILE - Execute any Cosmos message
// ============================================
interface ICosmos {
    /// @notice Execute a Cosmos SDK message from Solidity
    /// @param msg JSON-encoded Cosmos message
    function execute_cosmos(string calldata msg) external returns (bool);

    /// @notice Query Cosmos chain state from Solidity
    /// @param path Query path (e.g., "/cosmos.bank.v1beta1.Query/AllBalances")
    /// @param req JSON-encoded query request
    function query_cosmos(string calldata path, string calldata req)
        external view returns (string memory);
}

// ============================================
// SLINKY ORACLE - Enshrined price feeds
// ============================================
interface ISlinkyOracle {
    /// @notice Get price for a currency pair
    /// @param pair e.g., "BTC/USD", "INIT/USD"
    function get_price(string calldata pair)
        external view returns (uint256 price, uint256 timestamp);

    /// @notice List all supported price pairs
    function get_all_currency_pairs()
        external view returns (string[] memory);
}

// ============================================
// ERC20 BANK - Unified token interface
// ============================================
// No special interface needed!
// ALL tokens (native, IBC, ERC20) are standard ERC20
// Just use: IERC20(tokenAddress).balanceOf(user)
```

### Contract Architecture: SocialFi Trading (Idea 1)

```
┌────────────────────────────────────────────────────────┐
│                YOUR EVM MINITIA                         │
│                                                         │
│  User Flow:                                             │
│  1. Connect wallet via InterwovenKit                    │
│  2. Bridge assets via Interwoven Bridge                 │
│  3. Register .init username as trader identity          │
│  4. Create session key for auto-signing                 │
│  5. Follow top traders → auto-copy trades               │
│                                                         │
│  ┌──────────────┐      ┌───────────────────┐           │
│  │              │      │                   │           │
│  │TraderRegistry│─────►│    CopyVault      │           │
│  │              │      │                   │           │
│  │- .init name  │      │- deposit()        │           │
│  │- track P&L   │      │- follow(trader)   │           │
│  │- leaderboard │      │- autoExecute()    │           │
│  └──────────────┘      └────────┬──────────┘           │
│                                 │                       │
│                        ┌────────▼──────────┐           │
│                        │                   │           │
│                        │  TradeExecutor    │           │
│                        │                   │           │
│                        │- Session key auth │           │
│                        │- Execute swaps    │           │
│                        │- Slinky pricing   │           │
│                        └────────┬──────────┘           │
│                                 │                       │
│                        ┌────────▼──────────┐           │
│                        │  FeeCollector     │           │
│                        │                   │           │
│                        │- 0.1-0.3% fee     │           │
│                        │- Revenue to owner │           │
│                        │- Rewards to LPs   │           │
│                        └───────────────────┘           │
└────────────────────────────────────────────────────────┘
```

### Contract Architecture: Gaming Casino (Idea 4)

```
┌────────────────────────────────────────────────────────┐
│                YOUR EVM MINITIA                         │
│                                                         │
│  User Flow:                                             │
│  1. Connect wallet + claim .init gamertag               │
│  2. Bridge INIT/USDC via Interwoven Bridge              │
│  3. Create session key (bet without popups!)            │
│  4. Play games → every bet = on-chain tx                │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │                  Game Modules                     │  │
│  │                                                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │CoinFlip  │ │DiceRoll  │ │ PredictionMarket │  │  │
│  │  │          │ │          │ │                   │  │  │
│  │  │50/50     │ │1-100     │ │ Binary outcomes   │  │  │
│  │  │1.98x pay │ │up to 99x │ │ (sports, crypto)  │  │  │
│  │  └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │  │
│  │       │             │                │             │  │
│  │       └─────────────┼────────────────┘             │  │
│  │                     │                              │  │
│  └─────────────────────┼──────────────────────────────┘  │
│                        │                                  │
│               ┌────────▼────────┐                        │
│               │  SessionBetting │                        │
│               │                 │                        │
│               │  Auto-sign bets │                        │
│               │  via session key│                        │
│               └────────┬────────┘                        │
│                        │                                  │
│           ┌────────────▼────────────┐                    │
│           │                         │                    │
│      ┌────▼──────┐          ┌──────▼──────┐             │
│      │HouseVault │          │ Randomness  │             │
│      │           │          │ Provider    │             │
│      │Bankroll   │          │             │             │
│      │management │          │Commit-reveal│             │
│      │+ profits  │          │or VRF       │             │
│      └───────────┘          └─────────────┘             │
│                                                          │
│  Revenue:                                                │
│  ├── House edge: 1-3% per game                          │
│  ├── Sequencer fees: every bet = tx = revenue           │
│  └── Tournament rake                                    │
└────────────────────────────────────────────────────────┘
```

---

## Cross-Chain Communication

### IBC Token Transfer (EVM → Other Chain)

```
Your Minitia                    IBC                    Destination
┌──────────┐                                        ┌──────────┐
│ Solidity │  1. Call IBC precompile                 │          │
│ Contract │──────────────────────►                  │  Other   │
│          │                       │                 │  Minitia │
│          │  2. IBC Relayer       │                 │          │
│          │     picks up packet   │                 │          │
│          │                       ├────────────────►│ Token    │
│          │                                        │ arrives  │
│          │  3. Auto-minted as ERC20               │ as ERC20 │
└──────────┘                                        └──────────┘
```

### IBC Hook (Cross-Chain Contract Call)

```json
// Memo format for IBC hooks that trigger contract execution
{
  "evm": {
    "message": {
      "contract_addr": "0x...",
      "input": "0x<abi-encoded-calldata>"
    },
    "async_callback": {
      "contract_address": "0x...",
      "id": 1
    }
  }
}
```

---

## Infrastructure Setup

```
┌────────────────────────────────────────────────────────┐
│               Your Dev Machine                          │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │                Docker Desktop                      │ │
│  │  ┌─────────────┐  ┌─────────────────────────────┐│ │
│  │  │  minitiad    │  │  OPinit Executor + Relayer  ││ │
│  │  │  (EVM node)  │  │  (bridge + IBC)             ││ │
│  │  └─────────────┘  └─────────────────────────────┘│ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Foundry     │  │  weave   │  │  Node.js + pnpm  │  │
│  │  (contracts) │  │  (chain) │  │  (frontend)      │  │
│  └─────────────┘  └──────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Setup Commands

```bash
# 1. Install prerequisites
brew install go                    # Go 1.22+
brew install --cask docker         # Docker Desktop
curl -L https://foundry.paradigm.xyz | bash  # Foundry

# 2. Install Initia tools
# Install weave CLI (check docs for latest)
go install github.com/initia-labs/weave@latest

# 3. Initialize your appchain
weave init                         # Interactive setup
# Choose: EVM track
# Set: chain ID, gas denom, moniker

# 4. Start infrastructure
weave opinit init executor         # Bridge operator
weave relayer init                 # IBC relayer

# 5. Start everything (daemon mode)
weave start -d

# 6. Deploy contracts
cd contracts
forge build
forge script script/Deploy.s.sol --broadcast --rpc-url <your-minitia-rpc>

# 7. Start frontend
cd frontend
pnpm install
pnpm dev
```

---

## Security Considerations

| Layer | Threat | Mitigation |
|-------|--------|------------|
| Smart Contract | Reentrancy | ReentrancyGuard on all external calls |
| Smart Contract | Oracle manipulation | Slinky is enshrined (validator-run), use TWAP |
| Smart Contract | Flash loan attacks | Check block-level constraints |
| Session Keys | Over-permission | Scope session keys to specific contracts + amounts |
| Session Keys | Key theft | Time-limited sessions, revocable |
| IBC | Failed transfers | Timeout handling, refund logic |
| IBC Hooks | Callback reentrancy | Reentrancy guard on all IBC callbacks |
| Frontend | XSS | InterwovenKit uses Shadow DOM in production |
| Frontend | CSP bypass | Strict Content-Security-Policy headers |

---

## Comparison: Why Initia Wins

| Feature | Your Initia Appchain | Arbitrum/Base/OP |
|---------|---------------------|------------------|
| Revenue | 100% sequencer fees | 0% (paid to L2 operator) |
| Cross-chain | Native IBC (free) | Bridges ($$$, slow) |
| Oracle | Slinky precompile (free) | Chainlink (gas costs) |
| Block time | 100ms | 2,000ms |
| Throughput | 10K+ TPS (dedicated) | Shared with all apps |
| Sovereignty | Own chain, own rules | Shared L2 rules |
| Token standard | Unified ERC20 for everything | Different standards |
| Identity | .init usernames (native) | ENS (separate system) |
| Wallet UX | Session keys (auto-sign) | Approve every tx |
