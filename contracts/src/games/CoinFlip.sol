// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {HouseVault} from "../core/HouseVault.sol";
import {RandomnessProvider} from "../core/RandomnessProvider.sol";
import {SessionManager} from "../core/SessionManager.sol";
import {FeeCollector} from "../periphery/FeeCollector.sol";
import {Leaderboard} from "../periphery/Leaderboard.sol";

/// @title CoinFlip
/// @notice 50/50 coin flip game with 2% house edge (payout = 1.96x on win).
///         Uses commit-reveal randomness for provable fairness.
/// @dev Bet flow:
///   1. Player calls placeBet() with commitment hash and choice
///   2. House operator calls revealBet() with seeds
///   3. Contract resolves the bet and pays out if won
///   If house doesn't reveal in time, player calls claimTimeout() to get refund.
contract CoinFlip is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────

    /// @notice Payout multiplier in basis points (19600 = 1.96x)
    uint256 public constant PAYOUT_MULTIPLIER_BPS = 19_600;

    /// @notice Basis points denominator
    uint256 public constant BPS = 10_000;

    // ──────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────

    enum Choice {
        Heads,
        Tails
    }

    enum BetStatus {
        None,
        Pending,
        Won,
        Lost,
        Refunded
    }

    struct Bet {
        address player;
        uint256 amount;
        uint256 feeAmount;
        Choice choice;
        uint256 commitId; // RandomnessProvider commitment ID
        BetStatus status;
        uint256 payout;
    }

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    IERC20 public immutable token;
    HouseVault public immutable vault;
    RandomnessProvider public immutable randomness;
    SessionManager public immutable sessionManager;
    FeeCollector public immutable feeCollector;
    Leaderboard public immutable leaderboard;

    /// @notice Next bet ID
    uint256 public nextBetId;

    /// @notice Bet data
    mapping(uint256 => Bet) public bets;

    /// @notice Mapping from commitId to betId
    mapping(uint256 => uint256) public commitToBet;

    /// @notice Whether the game is paused
    bool public paused;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event BetPlaced(
        uint256 indexed betId, address indexed player, uint256 amount, Choice choice, uint256 commitId
    );
    event BetResolved(uint256 indexed betId, address indexed player, bool won, uint256 payout, Choice result);
    event BetRefunded(uint256 indexed betId, address indexed player, uint256 amount);
    event Paused(bool isPaused);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error GamePaused();
    error ZeroAmount();
    error BetTooLarge(uint256 amount, uint256 max);
    error BetNotPending(uint256 betId);
    error NotBetPlayer(uint256 betId);
    error InvalidBet(uint256 betId);

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    constructor(
        IERC20 _token,
        HouseVault _vault,
        RandomnessProvider _randomness,
        SessionManager _sessionManager,
        FeeCollector _feeCollector,
        Leaderboard _leaderboard
    ) Ownable(msg.sender) {
        token = _token;
        vault = _vault;
        randomness = _randomness;
        sessionManager = _sessionManager;
        feeCollector = _feeCollector;
        leaderboard = _leaderboard;
    }

    // ──────────────────────────────────────────────
    // Admin
    // ──────────────────────────────────────────────

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // ──────────────────────────────────────────────
    // Player functions
    // ──────────────────────────────────────────────

    /// @notice Place a coin flip bet
    /// @param amount The bet amount
    /// @param choice Heads (0) or Tails (1)
    /// @param playerCommitHash keccak256(abi.encodePacked(playerSeed))
    /// @return betId The bet ID
    function placeBet(uint256 amount, Choice choice, bytes32 playerCommitHash)
        external
        nonReentrant
        returns (uint256 betId)
    {
        if (paused) revert GamePaused();
        if (amount == 0) revert ZeroAmount();

        uint256 maxBetAmount = vault.maxBet();
        if (amount > maxBetAmount) revert BetTooLarge(amount, maxBetAmount);

        address player = msg.sender;

        // Calculate fee
        uint256 fee = feeCollector.calculateFee(amount);
        uint256 netBet = amount - fee;

        betId = nextBetId++;

        // Create randomness commitment
        uint256 commitId = randomness.commit(player, playerCommitHash, betId);

        // Store bet
        bets[betId] = Bet({
            player: player,
            amount: netBet,
            feeAmount: fee,
            choice: choice,
            commitId: commitId,
            status: BetStatus.Pending,
            payout: 0
        });

        commitToBet[commitId] = betId;

        // Interactions: transfer tokens from player
        token.safeTransferFrom(player, address(vault), netBet);

        // Transfer fee
        if (fee > 0) {
            token.safeTransferFrom(player, address(feeCollector), fee);
            feeCollector.collectFee(player, amount, fee);
        }

        // Record bet in vault
        vault.recordBet(player, netBet);

        emit BetPlaced(betId, player, netBet, choice, commitId);
    }

    /// @notice Place a bet using a session key (delegate can call this)
    /// @param sessionId The session ID
    /// @param amount The bet amount
    /// @param choice Heads (0) or Tails (1)
    /// @param playerCommitHash keccak256(abi.encodePacked(playerSeed))
    /// @return betId The bet ID
    function placeBetWithSession(uint256 sessionId, uint256 amount, Choice choice, bytes32 playerCommitHash)
        external
        nonReentrant
        returns (uint256 betId)
    {
        if (paused) revert GamePaused();
        if (amount == 0) revert ZeroAmount();

        uint256 maxBetAmount = vault.maxBet();
        if (amount > maxBetAmount) revert BetTooLarge(amount, maxBetAmount);

        // Validate session and get the actual player
        address player = sessionManager.useSession(sessionId, address(this), amount);

        uint256 fee = feeCollector.calculateFee(amount);
        uint256 netBet = amount - fee;

        betId = nextBetId++;

        uint256 commitId = randomness.commit(player, playerCommitHash, betId);

        bets[betId] = Bet({
            player: player,
            amount: netBet,
            feeAmount: fee,
            choice: choice,
            commitId: commitId,
            status: BetStatus.Pending,
            payout: 0
        });

        commitToBet[commitId] = betId;

        // Transfer from the player (they must have approved this contract)
        token.safeTransferFrom(player, address(vault), netBet);

        if (fee > 0) {
            token.safeTransferFrom(player, address(feeCollector), fee);
            feeCollector.collectFee(player, amount, fee);
        }

        vault.recordBet(player, netBet);

        emit BetPlaced(betId, player, netBet, choice, commitId);
    }

    /// @notice Resolve a bet after the house has revealed the server seed.
    ///         Can be called by anyone once the reveal is done.
    /// @param betId The bet to resolve
    /// @param playerSeed The player's original seed
    function resolveBet(uint256 betId, bytes32 playerSeed) external nonReentrant {
        Bet storage bet = bets[betId];
        if (bet.status != BetStatus.Pending) revert BetNotPending(betId);

        // Get the result from randomness provider
        bytes32 resultHash = randomness.getResult(bet.commitId, playerSeed);

        // Determine outcome: use first byte modulo 2
        uint256 resultNum = uint256(resultHash) % 2;
        Choice result = Choice(resultNum);

        bool won = (result == bet.choice);

        if (won) {
            uint256 payout = (bet.amount * PAYOUT_MULTIPLIER_BPS) / BPS;

            // Effects
            bet.status = BetStatus.Won;
            bet.payout = payout;

            // Interactions
            vault.sendPayout(bet.player, payout);
            leaderboard.recordGame(bet.player, bet.amount, payout);

            emit BetResolved(betId, bet.player, true, payout, result);
        } else {
            // Effects
            bet.status = BetStatus.Lost;
            bet.payout = 0;

            // The bet amount is already in the vault
            leaderboard.recordGame(bet.player, bet.amount, 0);

            emit BetResolved(betId, bet.player, false, 0, result);
        }
    }

    /// @notice Claim a refund if the house failed to reveal in time
    /// @param betId The bet to refund
    function claimTimeout(uint256 betId) external nonReentrant {
        Bet storage bet = bets[betId];
        if (bet.status != BetStatus.Pending) revert BetNotPending(betId);

        // Mark timed out in randomness provider (will revert if not timed out)
        randomness.markTimedOut(bet.commitId);

        // Effects
        bet.status = BetStatus.Refunded;
        bet.payout = bet.amount;

        // Interactions: refund the player from the vault
        vault.sendPayout(bet.player, bet.amount);

        emit BetRefunded(betId, bet.player, bet.amount);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    /// @notice Get bet details
    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    /// @notice Get payout for a given bet amount (before fees)
    function calculatePayout(uint256 betAmount) external pure returns (uint256) {
        return (betAmount * PAYOUT_MULTIPLIER_BPS) / BPS;
    }
}
