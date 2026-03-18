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

/// @title DiceRoll
/// @notice Variable odds dice game. Player picks a number 1-100, bets "under".
///         If the roll result is strictly less than the chosen number, player wins.
///         Payout = (100 / chosenNumber) * 0.98  (2% house edge)
///
///  Examples:
///   - Pick 50: win chance = 49/100, payout = (100/50)*0.98 = 1.96x
///   - Pick 10: win chance = 9/100, payout = (100/10)*0.98 = 9.80x (approx)
///   - Pick 95: win chance = 94/100, payout = (100/95)*0.98 = 1.03x (approx)
///
/// @dev Uses commit-reveal randomness. The payout multiplier formula:
///      payoutBps = (100 * 10000 / chosenNumber) * 98 / 100
///      This ensures a 2% house edge regardless of the chosen number.
contract DiceRoll is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────

    /// @notice Minimum chooseable number (2 means win chance = 1%)
    uint256 public constant MIN_CHOICE = 2;

    /// @notice Maximum chooseable number (100 means win chance = 99%)
    uint256 public constant MAX_CHOICE = 100;

    /// @notice House edge in basis points (200 = 2%)
    uint256 public constant HOUSE_EDGE_BPS = 200;

    /// @notice BPS denominator
    uint256 public constant BPS = 10_000;

    // ──────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────

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
        uint256 chosenNumber; // Player's chosen "under" number (2-100)
        uint256 commitId;
        BetStatus status;
        uint256 payout;
        uint256 rolledNumber; // The actual rolled number (1-100)
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

    uint256 public nextBetId = 1;
    mapping(uint256 => Bet) public bets;
    mapping(uint256 => uint256) public commitToBet;
    bool public paused;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event BetPlaced(
        uint256 indexed betId, address indexed player, uint256 amount, uint256 chosenNumber, uint256 commitId
    );
    event BetResolved(
        uint256 indexed betId, address indexed player, bool won, uint256 payout, uint256 rolledNumber
    );
    event BetRefunded(uint256 indexed betId, address indexed player, uint256 amount);
    event Paused(bool isPaused);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error GamePaused();
    error ZeroAmount();
    error InvalidChoice(uint256 choice);
    error BetTooLarge(uint256 amount, uint256 max);
    error BetNotPending(uint256 betId);

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
    // Payout calculation
    // ──────────────────────────────────────────────

    /// @notice Calculate the payout multiplier in BPS for a given choice
    /// @param chosenNumber The "under" number (2-100)
    /// @return multiplierBps The multiplier in basis points
    function getMultiplierBps(uint256 chosenNumber) public pure returns (uint256 multiplierBps) {
        // Payout = (100 / chosenNumber) * (1 - houseEdge)
        // In BPS: (100 * 10000 / chosenNumber) * (10000 - 200) / 10000
        // Simplified: 100 * (10000 - 200) / chosenNumber = 100 * 9800 / chosenNumber
        multiplierBps = (100 * (BPS - HOUSE_EDGE_BPS)) / chosenNumber;
    }

    /// @notice Calculate the payout for a given bet amount and choice
    function calculatePayout(uint256 betAmount, uint256 chosenNumber) public pure returns (uint256) {
        uint256 multiplierBps = getMultiplierBps(chosenNumber);
        return (betAmount * multiplierBps) / BPS;
    }

    /// @notice Get the max bet for a given chosen number
    function getMaxBet(uint256 chosenNumber) public view returns (uint256) {
        uint256 multiplierBps = getMultiplierBps(chosenNumber);
        return vault.maxBetForMultiplier(multiplierBps);
    }

    // ──────────────────────────────────────────────
    // Player functions
    // ──────────────────────────────────────────────

    /// @notice Place a dice roll bet
    /// @param amount The bet amount
    /// @param chosenNumber The "under" number (2-100). Win if roll < chosenNumber.
    /// @param playerCommitHash keccak256(abi.encodePacked(playerSeed))
    /// @return betId The bet ID
    function placeBet(uint256 amount, uint256 chosenNumber, bytes32 playerCommitHash)
        external
        nonReentrant
        returns (uint256 betId)
    {
        return _placeBet(msg.sender, amount, chosenNumber, playerCommitHash);
    }

    /// @notice Place a bet using a session key
    function placeBetWithSession(
        uint256 sessionId,
        uint256 amount,
        uint256 chosenNumber,
        bytes32 playerCommitHash
    ) external nonReentrant returns (uint256 betId) {
        address player = sessionManager.useSession(sessionId, msg.sender, address(this), amount);
        return _placeBet(player, amount, chosenNumber, playerCommitHash);
    }

    /// @notice Resolve a bet after house reveals
    function resolveBet(uint256 betId, bytes32 playerSeed) external nonReentrant {
        Bet storage bet = bets[betId];
        if (bet.status != BetStatus.Pending) revert BetNotPending(betId);

        bytes32 resultHash = randomness.getResult(bet.commitId, playerSeed);

        // Roll 1-100
        uint256 rolledNumber = (uint256(resultHash) % 100) + 1;

        bool won = rolledNumber < bet.chosenNumber;

        if (won) {
            uint256 payout = calculatePayout(bet.amount, bet.chosenNumber);

            // Effects
            bet.status = BetStatus.Won;
            bet.payout = payout;
            bet.rolledNumber = rolledNumber;

            // Interactions
            vault.sendPayout(bet.player, payout);
            leaderboard.recordGame(bet.player, bet.amount, payout);

            emit BetResolved(betId, bet.player, true, payout, rolledNumber);
        } else {
            // Effects
            bet.status = BetStatus.Lost;
            bet.payout = 0;
            bet.rolledNumber = rolledNumber;

            leaderboard.recordGame(bet.player, bet.amount, 0);

            emit BetResolved(betId, bet.player, false, 0, rolledNumber);
        }
    }

    /// @notice Claim refund on timeout
    function claimTimeout(uint256 betId) external nonReentrant {
        Bet storage bet = bets[betId];
        if (bet.status != BetStatus.Pending) revert BetNotPending(betId);

        randomness.markTimedOut(bet.commitId);

        bet.status = BetStatus.Refunded;
        bet.payout = bet.amount;

        vault.sendPayout(bet.player, bet.amount);

        emit BetRefunded(betId, bet.player, bet.amount);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    /// @notice Get win probability in basis points for a choice
    function getWinProbabilityBps(uint256 chosenNumber) external pure returns (uint256) {
        // Win if roll < chosenNumber. Roll is 1-100.
        // Win outcomes: 1, 2, ..., chosenNumber-1 = (chosenNumber - 1) outcomes out of 100
        return ((chosenNumber - 1) * BPS) / 100;
    }

    // ──────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────

    function _placeBet(address player, uint256 amount, uint256 chosenNumber, bytes32 playerCommitHash)
        internal
        returns (uint256 betId)
    {
        if (paused) revert GamePaused();
        if (amount == 0) revert ZeroAmount();
        if (chosenNumber < MIN_CHOICE || chosenNumber > MAX_CHOICE) revert InvalidChoice(chosenNumber);

        // Check max bet based on potential payout
        uint256 maxBetAmount = getMaxBet(chosenNumber);
        if (amount > maxBetAmount) revert BetTooLarge(amount, maxBetAmount);

        uint256 fee = feeCollector.calculateFee(amount);
        uint256 netBet = amount - fee;

        betId = nextBetId++;

        uint256 commitId = randomness.commit(player, playerCommitHash, betId);

        bets[betId] = Bet({
            player: player,
            amount: netBet,
            feeAmount: fee,
            chosenNumber: chosenNumber,
            commitId: commitId,
            status: BetStatus.Pending,
            payout: 0,
            rolledNumber: 0
        });

        commitToBet[commitId] = betId;

        // Interactions
        token.safeTransferFrom(player, address(vault), netBet);

        if (fee > 0) {
            token.safeTransferFrom(player, address(feeCollector), fee);
            feeCollector.collectFee(player, amount, fee);
        }

        vault.recordBet(player, netBet);

        emit BetPlaced(betId, player, netBet, chosenNumber, commitId);
    }
}
