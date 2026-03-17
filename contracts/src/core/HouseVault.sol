// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title HouseVault
/// @notice ERC4626-style vault where LPs deposit tokens to be the house bankroll.
///         Authorized game contracts can request payouts from the vault.
///         Profit/loss is socialized across all LP share holders.
/// @dev Max bet is capped at 2% of total bankroll to prevent catastrophic loss.
contract HouseVault is ERC4626, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ──────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────

    /// @notice Max bet denominator: max bet = bankroll / MAX_BET_DIVISOR (2%)
    uint256 public constant MAX_BET_DIVISOR = 50;

    /// @notice Epoch duration in seconds (1 day default)
    uint256 public constant EPOCH_DURATION = 1 days;

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    /// @notice Mapping of authorized game contracts
    mapping(address => bool) public authorizedGames;

    /// @notice List of all authorized game addresses (for enumeration)
    address[] public gameList;

    /// @notice Current epoch number (increments each EPOCH_DURATION)
    uint256 public currentEpoch;

    /// @notice Timestamp when the current epoch started
    uint256 public epochStartTime;

    /// @notice Cumulative profit (positive) or loss (negative) per epoch
    mapping(uint256 => int256) public epochPnL;

    /// @notice Total payouts ever made
    uint256 public totalPayouts;

    /// @notice Total bets received (wagered into the vault)
    uint256 public totalBetsReceived;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event GameAuthorized(address indexed game);
    event GameRevoked(address indexed game);
    event BetReceived(address indexed game, address indexed player, uint256 amount);
    event PayoutSent(address indexed game, address indexed player, uint256 amount);
    event EpochAdvanced(uint256 indexed epoch, int256 pnl);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error NotAuthorizedGame();
    error GameAlreadyAuthorized();
    error GameNotAuthorized();
    error BetExceedsMaxBet(uint256 betAmount, uint256 maxBet);
    error InsufficientBankroll(uint256 requested, uint256 available);
    error ZeroAddress();
    error ZeroAmount();

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────

    modifier onlyAuthorizedGame() {
        if (!authorizedGames[msg.sender]) revert NotAuthorizedGame();
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    /// @param asset_ The ERC20 token used as bankroll (e.g., INIT or USDC)
    constructor(
        IERC20 asset_
    )
        ERC4626(asset_)
        ERC20(
            string.concat("InitiaBet Vault ", IERC20Metadata(address(asset_)).symbol()),
            string.concat("ibv", IERC20Metadata(address(asset_)).symbol())
        )
        Ownable(msg.sender)
    {
        epochStartTime = block.timestamp;
        currentEpoch = 0;
    }

    // ──────────────────────────────────────────────
    // Admin functions
    // ──────────────────────────────────────────────

    /// @notice Authorize a game contract to request payouts
    /// @param game The game contract address
    function authorizeGame(address game) external onlyOwner {
        if (game == address(0)) revert ZeroAddress();
        if (authorizedGames[game]) revert GameAlreadyAuthorized();

        authorizedGames[game] = true;
        gameList.push(game);
        emit GameAuthorized(game);
    }

    /// @notice Revoke a game contract's authorization
    /// @param game The game contract address
    function revokeGame(address game) external onlyOwner {
        if (!authorizedGames[game]) revert GameNotAuthorized();

        authorizedGames[game] = false;

        // Remove from gameList
        uint256 len = gameList.length;
        for (uint256 i = 0; i < len; i++) {
            if (gameList[i] == game) {
                gameList[i] = gameList[len - 1];
                gameList.pop();
                break;
            }
        }

        emit GameRevoked(game);
    }

    // ──────────────────────────────────────────────
    // Game interface
    // ──────────────────────────────────────────────

    /// @notice Called by a game contract to record a bet (tokens transferred into vault)
    /// @param player The player who placed the bet
    /// @param amount The bet amount
    function recordBet(address player, uint256 amount) external onlyAuthorizedGame {
        if (amount == 0) revert ZeroAmount();
        _advanceEpochIfNeeded();

        totalBetsReceived += amount;
        epochPnL[currentEpoch] += int256(amount);

        emit BetReceived(msg.sender, player, amount);
    }

    /// @notice Called by a game contract to pay out a winner
    /// @dev The game contract must have already transferred the bet to the vault.
    ///      The vault sends the payout to the player.
    /// @param player The winning player
    /// @param amount The total payout amount (bet + winnings)
    function sendPayout(address player, uint256 amount) external nonReentrant onlyAuthorizedGame {
        if (amount == 0) revert ZeroAmount();
        if (player == address(0)) revert ZeroAddress();

        uint256 available = IERC20(asset()).balanceOf(address(this));
        if (amount > available) revert InsufficientBankroll(amount, available);

        _advanceEpochIfNeeded();

        // Effects
        totalPayouts += amount;
        epochPnL[currentEpoch] -= int256(amount);

        // Interactions
        SafeERC20.safeTransfer(IERC20(asset()), player, amount);

        emit PayoutSent(msg.sender, player, amount);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    /// @notice Get the current bankroll (total assets in the vault)
    function bankroll() external view returns (uint256) {
        return totalAssets();
    }

    /// @notice Get the maximum bet allowed (2% of bankroll)
    function maxBet() public view returns (uint256) {
        return totalAssets() / MAX_BET_DIVISOR;
    }

    /// @notice Get the maximum bet allowed considering potential payout multiplier
    /// @param multiplierBps The payout multiplier in basis points (10000 = 1x)
    /// @return The maximum bet such that payout does not exceed 2% of bankroll
    function maxBetForMultiplier(uint256 multiplierBps) external view returns (uint256) {
        if (multiplierBps == 0) return 0;
        // maxPayout = bankroll * 2% = bankroll / 50
        // maxBet = maxPayout / multiplier = (bankroll / 50) / (multiplierBps / 10000)
        // maxBet = bankroll * 10000 / (50 * multiplierBps)
        return (totalAssets() * 10_000) / (MAX_BET_DIVISOR * multiplierBps);
    }

    /// @notice Validate that a bet does not exceed the max bet limit
    /// @param betAmount The bet amount to validate
    function validateBet(uint256 betAmount) external view {
        uint256 max = maxBet();
        if (betAmount > max) revert BetExceedsMaxBet(betAmount, max);
    }

    /// @notice Get the number of authorized games
    function gameCount() external view returns (uint256) {
        return gameList.length;
    }

    /// @notice Get cumulative PnL for a given epoch
    function getEpochPnL(uint256 epoch) external view returns (int256) {
        return epochPnL[epoch];
    }

    // ──────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────

    /// @dev Advance epoch if enough time has passed
    function _advanceEpochIfNeeded() internal {
        if (block.timestamp >= epochStartTime + EPOCH_DURATION) {
            emit EpochAdvanced(currentEpoch, epochPnL[currentEpoch]);
            currentEpoch++;
            epochStartTime = block.timestamp;
        }
    }

    /// @inheritdoc ERC4626
    /// @dev Override to add reentrancy protection on deposits
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        return super.deposit(assets, receiver);
    }

    /// @inheritdoc ERC4626
    /// @dev Override to add reentrancy protection on mints
    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        return super.mint(shares, receiver);
    }

    /// @inheritdoc ERC4626
    /// @dev Override to add reentrancy protection on withdrawals
    function withdraw(uint256 assets, address receiver, address _owner) public override nonReentrant returns (uint256) {
        return super.withdraw(assets, receiver, _owner);
    }

    /// @inheritdoc ERC4626
    /// @dev Override to add reentrancy protection on redeems
    function redeem(uint256 shares, address receiver, address _owner) public override nonReentrant returns (uint256) {
        return super.redeem(shares, receiver, _owner);
    }
}
