// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FeeCollector
/// @notice Collects platform fees from all games and distributes them to
///         the protocol treasury and house vault LPs.
/// @dev Fee is a percentage of every bet volume, configurable by the owner.
contract FeeCollector is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────

    /// @notice Basis points denominator
    uint256 public constant BPS = 10_000;

    /// @notice Maximum fee in basis points (5%)
    uint256 public constant MAX_FEE_BPS = 500;

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    /// @notice The token used for fees
    IERC20 public immutable token;

    /// @notice Fee in basis points applied to bet volume (default 50 = 0.5%)
    uint256 public feeBps;

    /// @notice Protocol treasury address
    address public treasury;

    /// @notice House vault address (LP fee share goes here)
    address public houseVault;

    /// @notice Share of fees going to treasury in BPS (rest goes to house vault)
    /// @dev e.g., 5000 = 50% to treasury, 50% to house vault
    uint256 public treasuryShareBps;

    /// @notice Authorized game contracts that can call collectFee
    mapping(address => bool) public authorizedGames;

    /// @notice Total fees collected
    uint256 public totalFeesCollected;

    /// @notice Total fees distributed to treasury
    uint256 public totalTreasuryFees;

    /// @notice Total fees distributed to house vault
    uint256 public totalVaultFees;

    /// @notice Accumulated fees pending distribution
    uint256 public pendingFees;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event FeeCollected(address indexed game, address indexed player, uint256 betAmount, uint256 feeAmount);
    event FeesDistributed(uint256 treasuryAmount, uint256 vaultAmount);
    event FeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event HouseVaultUpdated(address indexed oldVault, address indexed newVault);
    event TreasuryShareUpdated(uint256 oldShare, uint256 newShare);
    event GameAuthorized(address indexed game);
    event GameRevoked(address indexed game);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error NotAuthorizedGame();
    error ZeroAddress();
    error FeeTooHigh(uint256 requested, uint256 max);
    error ShareTooHigh();
    error NothingToDistribute();

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    /// @param _token The ERC20 token for fees
    /// @param _treasury Protocol treasury address
    /// @param _houseVault House vault address
    /// @param _feeBps Fee in basis points (default 50 = 0.5%)
    /// @param _treasuryShareBps Treasury share of fees in BPS
    constructor(IERC20 _token, address _treasury, address _houseVault, uint256 _feeBps, uint256 _treasuryShareBps)
        Ownable(msg.sender)
    {
        if (address(_token) == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (_houseVault == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh(_feeBps, MAX_FEE_BPS);
        if (_treasuryShareBps > BPS) revert ShareTooHigh();

        token = _token;
        treasury = _treasury;
        houseVault = _houseVault;
        feeBps = _feeBps;
        treasuryShareBps = _treasuryShareBps;
    }

    // ──────────────────────────────────────────────
    // Admin
    // ──────────────────────────────────────────────

    function authorizeGame(address game) external onlyOwner {
        if (game == address(0)) revert ZeroAddress();
        authorizedGames[game] = true;
        emit GameAuthorized(game);
    }

    function revokeGame(address game) external onlyOwner {
        authorizedGames[game] = false;
        emit GameRevoked(game);
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh(_feeBps, MAX_FEE_BPS);
        uint256 old = feeBps;
        feeBps = _feeBps;
        emit FeeBpsUpdated(old, _feeBps);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function setHouseVault(address _houseVault) external onlyOwner {
        if (_houseVault == address(0)) revert ZeroAddress();
        address old = houseVault;
        houseVault = _houseVault;
        emit HouseVaultUpdated(old, _houseVault);
    }

    function setTreasuryShare(uint256 _treasuryShareBps) external onlyOwner {
        if (_treasuryShareBps > BPS) revert ShareTooHigh();
        uint256 old = treasuryShareBps;
        treasuryShareBps = _treasuryShareBps;
        emit TreasuryShareUpdated(old, _treasuryShareBps);
    }

    // ──────────────────────────────────────────────
    // Game interface
    // ──────────────────────────────────────────────

    /// @notice Calculate the fee for a given bet amount
    /// @param betAmount The bet amount
    /// @return fee The fee amount
    function calculateFee(uint256 betAmount) public view returns (uint256 fee) {
        fee = (betAmount * feeBps) / BPS;
    }

    /// @notice Collect fee from a game. The game must have already transferred
    ///         the fee amount to this contract before calling.
    /// @param player The player who placed the bet
    /// @param betAmount The total bet amount (fee is calculated from this)
    /// @param feeAmount The actual fee amount transferred
    function collectFee(address player, uint256 betAmount, uint256 feeAmount) external {
        if (!authorizedGames[msg.sender]) revert NotAuthorizedGame();

        totalFeesCollected += feeAmount;
        pendingFees += feeAmount;

        emit FeeCollected(msg.sender, player, betAmount, feeAmount);
    }

    // ──────────────────────────────────────────────
    // Distribution
    // ──────────────────────────────────────────────

    /// @notice Distribute accumulated fees to treasury and house vault
    function distributeFees() external nonReentrant {
        uint256 amount = pendingFees;
        if (amount == 0) revert NothingToDistribute();

        // Effects
        pendingFees = 0;

        uint256 treasuryAmount = (amount * treasuryShareBps) / BPS;
        uint256 vaultAmount = amount - treasuryAmount;

        totalTreasuryFees += treasuryAmount;
        totalVaultFees += vaultAmount;

        // Interactions
        if (treasuryAmount > 0) {
            token.safeTransfer(treasury, treasuryAmount);
        }
        if (vaultAmount > 0) {
            token.safeTransfer(houseVault, vaultAmount);
        }

        emit FeesDistributed(treasuryAmount, vaultAmount);
    }
}
