// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {HouseVault} from "../core/HouseVault.sol";
import {RandomnessProvider} from "../core/RandomnessProvider.sol";
import {SessionManager} from "../core/SessionManager.sol";
import {FeeCollector} from "../periphery/FeeCollector.sol";
import {Leaderboard} from "../periphery/Leaderboard.sol";

/// @title CrashGame
/// @notice Multiplier crash game where players cash out before the crash point.
///
///  Round flow:
///   1. Operator starts a new round with a commitment hash
///   2. Players place bets during the betting window
///   3. Round begins (no more bets)
///   4. Multiplier increases. Players call cashOut() to lock in their multiplier.
///   5. Operator reveals the crash point (provably fair via commit-reveal)
///   6. Players who cashed out below the crash point win.
///      Players who didn't cash out or cashed out above crash point lose.
///
/// @dev The crash point is determined by: hash(serverSeed, roundId).
///      CrashPoint = max(100, (2^52) / (hash_value % 2^52) * 98 / 100)
///      This gives a house edge of ~2% and crash points from 1.00x to very high.
contract CrashGame is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ──────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────

    /// @notice Minimum crash point (1.00x in BPS = 10000)
    uint256 public constant MIN_CRASH_BPS = 10_000;

    /// @notice BPS denominator
    uint256 public constant BPS = 10_000;

    /// @notice House edge applied to crash point (98/100 = 2% edge)
    uint256 public constant HOUSE_EDGE_NUMERATOR = 98;
    uint256 public constant HOUSE_EDGE_DENOMINATOR = 100;

    /// @notice Maximum players per round
    uint256 public constant MAX_PLAYERS_PER_ROUND = 100;

    /// @notice Maximum cash-out multiplier in BPS (100x = 1_000_000 BPS)
    /// @dev Caps the maximum possible payout to prevent vault drainage
    uint256 public constant MAX_CASHOUT_MULTIPLIER_BPS = 1_000_000;

    /// @notice Timeout for a running round (operator must crash within this window)
    uint256 public constant ROUND_TIMEOUT = 1 hours;

    // ──────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────

    enum RoundStatus {
        None,
        Betting, // Accepting bets
        Running, // No more bets, multiplier increasing
        Crashed, // Round ended, crash point revealed
        Cancelled // Round was cancelled (refunds)
    }

    struct Round {
        uint256 roundId;
        RoundStatus status;
        bytes32 serverCommitHash; // hash(serverSeed)
        bytes32 serverSeed; // Revealed after crash
        uint256 crashPointBps; // The crash multiplier in BPS (e.g. 15000 = 1.50x)
        uint256 bettingEndTime; // When betting window closes
        uint256 startTime; // When the round started running
        uint256 totalBets; // Sum of all bets in this round
        uint256 totalPayouts; // Sum of all payouts in this round
        uint256 playerCount;
    }

    struct PlayerBet {
        address player;
        uint256 amount;
        uint256 feeAmount;
        uint256 cashOutMultiplierBps; // 0 if not cashed out
        bool cashedOut;
        uint256 payout;
    }

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    IERC20 public immutable token;
    HouseVault public immutable vault;
    SessionManager public immutable sessionManager;
    FeeCollector public immutable feeCollector;
    Leaderboard public immutable leaderboard;

    /// @notice House operator who manages rounds
    address public operator;

    /// @notice Duration of betting window in seconds
    uint256 public bettingDuration;

    /// @notice Current round ID
    uint256 public currentRoundId;

    /// @notice Round data
    mapping(uint256 => Round) public rounds;

    /// @notice Player bets per round: roundId => index => PlayerBet
    mapping(uint256 => mapping(uint256 => PlayerBet)) public roundBets;

    /// @notice Player bet index in round: roundId => player => betIndex (1-indexed, 0 = no bet)
    mapping(uint256 => mapping(address => uint256)) public playerBetIndex;

    /// @notice Whether the game is paused
    bool public paused;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event RoundStarted(uint256 indexed roundId, bytes32 serverCommitHash, uint256 bettingEndTime);
    event BetPlaced(uint256 indexed roundId, address indexed player, uint256 amount);
    event CashedOut(uint256 indexed roundId, address indexed player, uint256 multiplierBps, uint256 payout);
    event RoundCrashed(uint256 indexed roundId, uint256 crashPointBps, bytes32 serverSeed);
    event RoundCancelled(uint256 indexed roundId);
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event BettingDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event Paused(bool isPaused);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error GamePaused();
    error NotOperator();
    error ZeroAmount();
    error ZeroAddress();
    error RoundNotInStatus(uint256 roundId, RoundStatus expected, RoundStatus actual);
    error BettingWindowClosed(uint256 roundId);
    error BettingWindowNotClosed(uint256 roundId);
    error AlreadyBet(uint256 roundId, address player);
    error NoBetFound(uint256 roundId, address player);
    error AlreadyCashedOut(uint256 roundId, address player);
    error InvalidServerSeed(uint256 roundId);
    error BetTooLarge(uint256 amount, uint256 max);
    error TooManyPlayers(uint256 roundId);
    error InvalidCashOutMultiplier();
    error CashOutMultiplierTooHigh(uint256 requested, uint256 max);
    error RoundNotTimedOut(uint256 roundId);
    error RoundTimedOut(uint256 roundId);

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    constructor(
        IERC20 _token,
        HouseVault _vault,
        SessionManager _sessionManager,
        FeeCollector _feeCollector,
        Leaderboard _leaderboard,
        address _operator,
        uint256 _bettingDuration
    ) Ownable(msg.sender) {
        token = _token;
        vault = _vault;
        sessionManager = _sessionManager;
        feeCollector = _feeCollector;
        leaderboard = _leaderboard;
        operator = _operator;
        bettingDuration = _bettingDuration;
    }

    // ──────────────────────────────────────────────
    // Admin
    // ──────────────────────────────────────────────

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function setOperator(address _operator) external onlyOwner {
        if (_operator == address(0)) revert ZeroAddress();
        address old = operator;
        operator = _operator;
        emit OperatorUpdated(old, _operator);
    }

    function setBettingDuration(uint256 _duration) external onlyOwner {
        uint256 old = bettingDuration;
        bettingDuration = _duration;
        emit BettingDurationUpdated(old, _duration);
    }

    // ──────────────────────────────────────────────
    // Operator functions
    // ──────────────────────────────────────────────

    /// @notice Start a new round. The operator commits a server seed hash.
    /// @param serverCommitHash hash(serverSeed)
    /// @return roundId The new round ID
    function startRound(bytes32 serverCommitHash) external onlyOperator returns (uint256 roundId) {
        if (paused) revert GamePaused();

        roundId = ++currentRoundId;

        rounds[roundId] = Round({
            roundId: roundId,
            status: RoundStatus.Betting,
            serverCommitHash: serverCommitHash,
            serverSeed: bytes32(0),
            crashPointBps: 0,
            bettingEndTime: block.timestamp + bettingDuration,
            startTime: 0,
            totalBets: 0,
            totalPayouts: 0,
            playerCount: 0
        });

        emit RoundStarted(roundId, serverCommitHash, block.timestamp + bettingDuration);
    }

    /// @notice Transition from betting to running state
    /// @param roundId The round to start
    function beginRound(uint256 roundId) external onlyOperator {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.Betting) {
            revert RoundNotInStatus(roundId, RoundStatus.Betting, round.status);
        }
        if (block.timestamp < round.bettingEndTime) {
            revert BettingWindowNotClosed(roundId);
        }

        round.status = RoundStatus.Running;
        round.startTime = block.timestamp;
    }

    /// @notice End a round by revealing the server seed. Computes crash point and settles all bets.
    /// @param roundId The round to end
    /// @param serverSeed The server seed (must hash to serverCommitHash)
    function crashRound(uint256 roundId, bytes32 serverSeed) external nonReentrant onlyOperator {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.Running) {
            revert RoundNotInStatus(roundId, RoundStatus.Running, round.status);
        }
        if (block.timestamp >= round.startTime + ROUND_TIMEOUT) {
            revert RoundTimedOut(roundId);
        }

        // Verify server seed
        if (keccak256(abi.encodePacked(serverSeed)) != round.serverCommitHash) {
            revert InvalidServerSeed(roundId);
        }

        // Compute crash point
        uint256 crashBps = _computeCrashPoint(serverSeed, roundId);

        // Effects
        round.serverSeed = serverSeed;
        round.crashPointBps = crashBps;
        round.status = RoundStatus.Crashed;

        // Settle all bets
        uint256 count = round.playerCount;
        for (uint256 i = 0; i < count; i++) {
            PlayerBet storage pb = roundBets[roundId][i];

            if (pb.cashedOut && pb.cashOutMultiplierBps <= crashBps) {
                // Player won: they cashed out before crash
                uint256 payout = (pb.amount * pb.cashOutMultiplierBps) / BPS;
                pb.payout = payout;
                round.totalPayouts += payout;

                vault.sendPayout(pb.player, payout);
                leaderboard.recordGame(pb.player, pb.amount, payout);
            } else {
                // Player lost: didn't cash out or cashed out above crash point
                pb.payout = 0;
                leaderboard.recordGame(pb.player, pb.amount, 0);
            }
        }

        emit RoundCrashed(roundId, crashBps, serverSeed);
    }

    /// @notice Cancel a round (e.g., if no players joined). Refunds all bets.
    function cancelRound(uint256 roundId) external nonReentrant onlyOperator {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.Betting && round.status != RoundStatus.Running) {
            revert RoundNotInStatus(roundId, RoundStatus.Betting, round.status);
        }

        round.status = RoundStatus.Cancelled;

        // Refund all bets
        uint256 count = round.playerCount;
        for (uint256 i = 0; i < count; i++) {
            PlayerBet storage pb = roundBets[roundId][i];
            if (pb.amount > 0) {
                pb.payout = pb.amount;
                vault.sendPayout(pb.player, pb.amount);
            }
        }

        emit RoundCancelled(roundId);
    }

    /// @notice Claim refund if the operator failed to crash a running round within ROUND_TIMEOUT.
    ///         Can be called by anyone. Refunds all player bets.
    /// @param roundId The round that timed out
    function claimRoundTimeout(uint256 roundId) external nonReentrant {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.Running) {
            revert RoundNotInStatus(roundId, RoundStatus.Running, round.status);
        }
        if (block.timestamp < round.startTime + ROUND_TIMEOUT) {
            revert RoundNotTimedOut(roundId);
        }

        round.status = RoundStatus.Cancelled;

        // Refund all bets
        uint256 count = round.playerCount;
        for (uint256 i = 0; i < count; i++) {
            PlayerBet storage pb = roundBets[roundId][i];
            if (pb.amount > 0) {
                pb.payout = pb.amount;
                vault.sendPayout(pb.player, pb.amount);
            }
        }

        emit RoundCancelled(roundId);
    }

    // ──────────────────────────────────────────────
    // Player functions
    // ──────────────────────────────────────────────

    /// @notice Place a bet in the current round during betting window
    /// @param roundId The round to bet in
    /// @param amount The bet amount
    function placeBet(uint256 roundId, uint256 amount) external nonReentrant {
        _placeBet(roundId, msg.sender, amount);
    }

    /// @notice Place a bet using a session key
    function placeBetWithSession(uint256 roundId, uint256 sessionId, uint256 amount) external nonReentrant {
        address player = sessionManager.useSession(sessionId, msg.sender, address(this), amount);
        _placeBet(roundId, player, amount);
    }

    /// @notice Cash out at the current multiplier during a running round.
    ///         The multiplier is passed by the caller and validated.
    /// @param roundId The round
    /// @param multiplierBps The multiplier to cash out at (in BPS, e.g., 15000 = 1.50x)
    function cashOut(uint256 roundId, uint256 multiplierBps) external nonReentrant {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.Running) {
            revert RoundNotInStatus(roundId, RoundStatus.Running, round.status);
        }
        if (multiplierBps < MIN_CRASH_BPS) revert InvalidCashOutMultiplier();
        if (multiplierBps > MAX_CASHOUT_MULTIPLIER_BPS) revert CashOutMultiplierTooHigh(multiplierBps, MAX_CASHOUT_MULTIPLIER_BPS);

        uint256 idx = playerBetIndex[roundId][msg.sender];
        if (idx == 0) revert NoBetFound(roundId, msg.sender);

        PlayerBet storage pb = roundBets[roundId][idx - 1];
        if (pb.cashedOut) revert AlreadyCashedOut(roundId, msg.sender);

        pb.cashedOut = true;
        pb.cashOutMultiplierBps = multiplierBps;

        // Payout will be calculated when crash point is revealed
        emit CashedOut(roundId, msg.sender, multiplierBps, 0);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }

    function getPlayerBet(uint256 roundId, address player) external view returns (PlayerBet memory) {
        uint256 idx = playerBetIndex[roundId][player];
        if (idx == 0) revert NoBetFound(roundId, player);
        return roundBets[roundId][idx - 1];
    }

    function getRoundPlayers(uint256 roundId) external view returns (PlayerBet[] memory) {
        Round storage round = rounds[roundId];
        uint256 count = round.playerCount;
        PlayerBet[] memory result = new PlayerBet[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = roundBets[roundId][i];
        }
        return result;
    }

    /// @notice Verify that a crash point was fairly computed
    function verifyCrashPoint(bytes32 serverSeed, uint256 roundId) external pure returns (uint256) {
        return _computeCrashPoint(serverSeed, roundId);
    }

    // ──────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────

    function _placeBet(uint256 roundId, address player, uint256 amount) internal {
        if (paused) revert GamePaused();
        if (amount == 0) revert ZeroAmount();

        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.Betting) {
            revert RoundNotInStatus(roundId, RoundStatus.Betting, round.status);
        }
        if (block.timestamp >= round.bettingEndTime) revert BettingWindowClosed(roundId);
        if (playerBetIndex[roundId][player] != 0) revert AlreadyBet(roundId, player);
        if (round.playerCount >= MAX_PLAYERS_PER_ROUND) revert TooManyPlayers(roundId);

        uint256 maxBetAmount = vault.maxBet();
        if (amount > maxBetAmount) revert BetTooLarge(amount, maxBetAmount);

        uint256 fee = feeCollector.calculateFee(amount);
        uint256 netBet = amount - fee;

        uint256 idx = round.playerCount;
        round.playerCount++;
        round.totalBets += netBet;

        // 1-indexed so 0 means "no bet"
        playerBetIndex[roundId][player] = idx + 1;

        roundBets[roundId][idx] = PlayerBet({
            player: player,
            amount: netBet,
            feeAmount: fee,
            cashOutMultiplierBps: 0,
            cashedOut: false,
            payout: 0
        });

        // Interactions
        token.safeTransferFrom(player, address(vault), netBet);

        if (fee > 0) {
            token.safeTransferFrom(player, address(feeCollector), fee);
            feeCollector.collectFee(player, amount, fee);
        }

        vault.recordBet(player, netBet);

        emit BetPlaced(roundId, player, netBet);
    }

    /// @notice Compute crash point from server seed and round ID
    /// @dev CrashPoint = max(10000, floor(2^52 / (hash % 2^52 + 1)) * 98 / 100 * BPS / 100)
    ///      Simplified to give a distribution where:
    ///      - ~1% chance of instant crash (1.00x)
    ///      - Higher multipliers become progressively rarer
    ///      - 2% house edge built in
    function _computeCrashPoint(bytes32 serverSeed, uint256 roundId) internal pure returns (uint256) {
        bytes32 hash = keccak256(abi.encodePacked(serverSeed, roundId));
        uint256 h = uint256(hash);

        // Use lower 52 bits
        uint256 divisor = (h % (1 << 52)) + 1;

        // Raw multiplier (in units of 1/100, so 100 = 1.00x)
        uint256 rawMultiplier = ((1 << 52) * 100) / divisor;

        // Apply house edge (98/100)
        uint256 adjustedMultiplier = (rawMultiplier * HOUSE_EDGE_NUMERATOR) / HOUSE_EDGE_DENOMINATOR;

        // Convert to BPS (1.00x = 10000 BPS)
        // rawMultiplier of 100 = 1.00x = 10000 BPS
        uint256 crashBps = adjustedMultiplier * 100;

        // Minimum crash point is 1.00x
        if (crashBps < MIN_CRASH_BPS) {
            crashBps = MIN_CRASH_BPS;
        }

        return crashBps;
    }
}
