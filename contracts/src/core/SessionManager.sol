// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title SessionManager
/// @notice Manages session keys that allow delegates to place bets on behalf of users.
///         Users create session keys with constraints (max bet, expiry, allowed games).
///         Session keys can place bets without requiring the user to sign each transaction.
/// @dev Designed for Initia MiniEVM's 100ms block times where UX matters.
contract SessionManager is Ownable2Step {
    // ──────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────

    struct Session {
        address owner; // The user who created the session
        address delegate; // The address authorized to act on behalf of the user
        uint256 maxBetAmount; // Maximum bet amount per bet
        uint256 expiresAt; // Timestamp when session expires
        uint256 totalSpent; // Cumulative amount spent via this session
        uint256 spendingLimit; // Total spending limit for the session
        bool revoked; // Whether the session has been revoked
    }

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    /// @notice Session ID counter
    uint256 public nextSessionId;

    /// @notice Session data by ID
    mapping(uint256 => Session) public sessions;

    /// @notice Allowed games per session: sessionId => gameAddress => allowed
    mapping(uint256 => mapping(address => bool)) public sessionAllowedGames;

    /// @notice Active session IDs per user
    mapping(address => uint256[]) public userSessions;

    /// @notice Active session IDs per delegate
    mapping(address => uint256[]) public delegateSessions;

    /// @notice Registered game contracts (only registered games can be allowed)
    mapping(address => bool) public registeredGames;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event SessionCreated(
        uint256 indexed sessionId,
        address indexed owner,
        address indexed delegate,
        uint256 maxBetAmount,
        uint256 spendingLimit,
        uint256 expiresAt
    );
    event SessionRevoked(uint256 indexed sessionId, address indexed owner);
    event SessionUsed(uint256 indexed sessionId, address indexed game, uint256 amount);
    event GameRegistered(address indexed game);
    event GameUnregistered(address indexed game);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error SessionExpired(uint256 sessionId);
    error SessionRevoked_();
    error SessionNotFound();
    error NotSessionOwner();
    error NotSessionDelegate();
    error BetExceedsSessionMax(uint256 amount, uint256 maxBet);
    error SpendingLimitExceeded(uint256 totalAfter, uint256 limit);
    error GameNotAllowed(address game);
    error GameNotRegistered(address game);
    error ZeroAddress();
    error ZeroAmount();
    error InvalidExpiry();
    error NoGamesSpecified();

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ──────────────────────────────────────────────
    // Admin
    // ──────────────────────────────────────────────

    /// @notice Register a game contract that can be used in sessions
    function registerGame(address game) external onlyOwner {
        if (game == address(0)) revert ZeroAddress();
        registeredGames[game] = true;
        emit GameRegistered(game);
    }

    /// @notice Unregister a game contract
    function unregisterGame(address game) external onlyOwner {
        registeredGames[game] = false;
        emit GameUnregistered(game);
    }

    // ──────────────────────────────────────────────
    // User functions
    // ──────────────────────────────────────────────

    /// @notice Create a session key for a delegate
    /// @param delegate The address that can act on behalf of the caller
    /// @param maxBetAmount Maximum bet amount per individual bet
    /// @param spendingLimit Total spending limit for the entire session
    /// @param expiresAt Timestamp when the session expires
    /// @param allowedGames Array of game contract addresses the delegate can use
    /// @return sessionId The ID of the created session
    function createSession(
        address delegate,
        uint256 maxBetAmount,
        uint256 spendingLimit,
        uint256 expiresAt,
        address[] calldata allowedGames
    ) external returns (uint256 sessionId) {
        if (delegate == address(0)) revert ZeroAddress();
        if (maxBetAmount == 0) revert ZeroAmount();
        if (spendingLimit == 0) revert ZeroAmount();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();
        if (allowedGames.length == 0) revert NoGamesSpecified();

        sessionId = nextSessionId++;

        sessions[sessionId] = Session({
            owner: msg.sender,
            delegate: delegate,
            maxBetAmount: maxBetAmount,
            expiresAt: expiresAt,
            totalSpent: 0,
            spendingLimit: spendingLimit,
            revoked: false
        });

        for (uint256 i = 0; i < allowedGames.length; i++) {
            if (!registeredGames[allowedGames[i]]) revert GameNotRegistered(allowedGames[i]);
            sessionAllowedGames[sessionId][allowedGames[i]] = true;
        }

        userSessions[msg.sender].push(sessionId);
        delegateSessions[delegate].push(sessionId);

        emit SessionCreated(sessionId, msg.sender, delegate, maxBetAmount, spendingLimit, expiresAt);
    }

    /// @notice Revoke a session. Only the session owner can revoke.
    /// @param sessionId The session to revoke
    function revokeSession(uint256 sessionId) external {
        Session storage session = sessions[sessionId];
        if (session.owner == address(0)) revert SessionNotFound();
        if (session.owner != msg.sender) revert NotSessionOwner();

        session.revoked = true;
        emit SessionRevoked(sessionId, msg.sender);
    }

    // ──────────────────────────────────────────────
    // Game interface
    // ──────────────────────────────────────────────

    /// @notice Validate and record a bet using a session key.
    ///         Called by game contracts.
    /// @param sessionId The session ID to use
    /// @param delegate The delegate address (must match session delegate; typically tx.origin)
    /// @param game The game contract address (should be msg.sender in the game)
    /// @param amount The bet amount
    /// @return owner The session owner (the actual player)
    function useSession(uint256 sessionId, address delegate, address game, uint256 amount) external returns (address owner) {
        Session storage session = sessions[sessionId];
        if (session.owner == address(0)) revert SessionNotFound();
        if (session.delegate != delegate) revert NotSessionDelegate();
        if (session.revoked) revert SessionRevoked_();
        if (block.timestamp >= session.expiresAt) revert SessionExpired(sessionId);
        if (!sessionAllowedGames[sessionId][game]) revert GameNotAllowed(game);
        if (amount > session.maxBetAmount) revert BetExceedsSessionMax(amount, session.maxBetAmount);

        uint256 newTotal = session.totalSpent + amount;
        if (newTotal > session.spendingLimit) revert SpendingLimitExceeded(newTotal, session.spendingLimit);

        // Effects
        session.totalSpent = newTotal;

        emit SessionUsed(sessionId, game, amount);

        return session.owner;
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    /// @notice Check if a session is currently valid
    function isSessionValid(uint256 sessionId) external view returns (bool) {
        Session storage session = sessions[sessionId];
        return session.owner != address(0) && !session.revoked && block.timestamp < session.expiresAt;
    }

    /// @notice Get all session IDs for a user
    function getUserSessions(address user) external view returns (uint256[] memory) {
        return userSessions[user];
    }

    /// @notice Get all session IDs for a delegate
    function getDelegateSessions(address delegate) external view returns (uint256[] memory) {
        return delegateSessions[delegate];
    }

    /// @notice Get the remaining spending limit for a session
    function remainingLimit(uint256 sessionId) external view returns (uint256) {
        Session storage session = sessions[sessionId];
        if (session.totalSpent >= session.spendingLimit) return 0;
        return session.spendingLimit - session.totalSpent;
    }

    /// @notice Get the delegate for a session
    function getSessionDelegate(uint256 sessionId) external view returns (address) {
        return sessions[sessionId].delegate;
    }

    /// @notice Get the owner for a session
    function getSessionOwner(uint256 sessionId) external view returns (address) {
        return sessions[sessionId].owner;
    }
}
