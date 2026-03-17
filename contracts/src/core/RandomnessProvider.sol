// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title RandomnessProvider
/// @notice Commit-reveal randomness scheme for provably fair gaming.
///
///  Flow:
///   1. Player commits: hash(playerSeed) along with bet details
///   2. House reveals: serverSeed for the commitment
///   3. Result computed: keccak256(playerSeed, serverSeed, nonce)
///
///  If the house fails to reveal within the timeout window, the player
///  can claim a refund (the game treats it as a player win by default).
///
/// @dev Game contracts call into this to manage the commit-reveal lifecycle.
contract RandomnessProvider is Ownable2Step {
    // ──────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────

    enum CommitStatus {
        None,
        Committed,
        Revealed,
        TimedOut
    }

    struct Commitment {
        address player;
        address game;
        bytes32 playerCommitHash; // keccak256(abi.encodePacked(playerSeed))
        bytes32 serverSeed; // Revealed by house
        uint256 betId; // Game-specific bet identifier
        uint256 commitBlock; // Block when commitment was made
        uint256 commitTimestamp; // Timestamp when commitment was made
        CommitStatus status;
    }

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    /// @notice Unique commitment counter
    uint256 public nextCommitId;

    /// @notice Commitment data
    mapping(uint256 => Commitment) public commitments;

    /// @notice House operator address (can reveal seeds)
    address public houseOperator;

    /// @notice Timeout duration in seconds for house to reveal
    /// @dev Default 300 seconds (5 minutes). With 100ms blocks, this is very generous.
    uint256 public revealTimeout;

    /// @notice Authorized game contracts
    mapping(address => bool) public authorizedGames;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event CommitmentCreated(
        uint256 indexed commitId, address indexed player, address indexed game, bytes32 playerCommitHash, uint256 betId
    );
    event CommitmentRevealed(uint256 indexed commitId, bytes32 serverSeed, bytes32 resultHash);
    event CommitmentTimedOut(uint256 indexed commitId);
    event HouseOperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event RevealTimeoutUpdated(uint256 oldTimeout, uint256 newTimeout);
    event GameAuthorized(address indexed game);
    event GameRevoked(address indexed game);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error NotAuthorizedGame();
    error NotHouseOperator();
    error InvalidCommitStatus(uint256 commitId, CommitStatus current, CommitStatus expected);
    error RevealTimeoutNotReached(uint256 commitId);
    error InvalidPlayerSeed(uint256 commitId);
    error ZeroAddress();

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────

    modifier onlyAuthorizedGame() {
        if (!authorizedGames[msg.sender]) revert NotAuthorizedGame();
        _;
    }

    modifier onlyHouseOperator() {
        if (msg.sender != houseOperator) revert NotHouseOperator();
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    /// @param _houseOperator The address that reveals server seeds
    /// @param _revealTimeout Timeout in seconds for the house to reveal
    constructor(address _houseOperator, uint256 _revealTimeout) Ownable(msg.sender) {
        if (_houseOperator == address(0)) revert ZeroAddress();
        houseOperator = _houseOperator;
        revealTimeout = _revealTimeout;
    }

    // ──────────────────────────────────────────────
    // Admin
    // ──────────────────────────────────────────────

    /// @notice Set a new house operator
    function setHouseOperator(address _operator) external onlyOwner {
        if (_operator == address(0)) revert ZeroAddress();
        address old = houseOperator;
        houseOperator = _operator;
        emit HouseOperatorUpdated(old, _operator);
    }

    /// @notice Update the reveal timeout
    function setRevealTimeout(uint256 _timeout) external onlyOwner {
        uint256 old = revealTimeout;
        revealTimeout = _timeout;
        emit RevealTimeoutUpdated(old, _timeout);
    }

    /// @notice Authorize a game contract
    function authorizeGame(address game) external onlyOwner {
        if (game == address(0)) revert ZeroAddress();
        authorizedGames[game] = true;
        emit GameAuthorized(game);
    }

    /// @notice Revoke a game contract
    function revokeGame(address game) external onlyOwner {
        authorizedGames[game] = false;
        emit GameRevoked(game);
    }

    // ──────────────────────────────────────────────
    // Commit phase (called by game contracts)
    // ──────────────────────────────────────────────

    /// @notice Create a new commitment
    /// @param player The player address
    /// @param playerCommitHash keccak256(abi.encodePacked(playerSeed))
    /// @param betId Game-specific bet identifier
    /// @return commitId The commitment ID
    function commit(address player, bytes32 playerCommitHash, uint256 betId)
        external
        onlyAuthorizedGame
        returns (uint256 commitId)
    {
        commitId = nextCommitId++;

        commitments[commitId] = Commitment({
            player: player,
            game: msg.sender,
            playerCommitHash: playerCommitHash,
            serverSeed: bytes32(0),
            betId: betId,
            commitBlock: block.number,
            commitTimestamp: block.timestamp,
            status: CommitStatus.Committed
        });

        emit CommitmentCreated(commitId, player, msg.sender, playerCommitHash, betId);
    }

    // ──────────────────────────────────────────────
    // Reveal phase (called by house operator)
    // ──────────────────────────────────────────────

    /// @notice House reveals its server seed and the player's seed is verified
    /// @param commitId The commitment to reveal
    /// @param serverSeed The house's server seed
    /// @param playerSeed The player's original seed (must hash to playerCommitHash)
    /// @return resultHash The final random result hash
    function reveal(uint256 commitId, bytes32 serverSeed, bytes32 playerSeed)
        external
        onlyHouseOperator
        returns (bytes32 resultHash)
    {
        Commitment storage c = commitments[commitId];

        if (c.status != CommitStatus.Committed) {
            revert InvalidCommitStatus(commitId, c.status, CommitStatus.Committed);
        }

        // Verify player seed matches commitment
        bytes32 expectedHash = keccak256(abi.encodePacked(playerSeed));
        if (expectedHash != c.playerCommitHash) revert InvalidPlayerSeed(commitId);

        // Compute result
        resultHash = keccak256(abi.encodePacked(playerSeed, serverSeed, commitId));

        // Effects
        c.serverSeed = serverSeed;
        c.status = CommitStatus.Revealed;

        emit CommitmentRevealed(commitId, serverSeed, resultHash);
    }

    // ──────────────────────────────────────────────
    // Timeout (called by game contracts on behalf of player)
    // ──────────────────────────────────────────────

    /// @notice Mark a commitment as timed out if house failed to reveal in time
    /// @param commitId The commitment that timed out
    function markTimedOut(uint256 commitId) external onlyAuthorizedGame {
        Commitment storage c = commitments[commitId];

        if (c.status != CommitStatus.Committed) {
            revert InvalidCommitStatus(commitId, c.status, CommitStatus.Committed);
        }
        if (block.timestamp < c.commitTimestamp + revealTimeout) {
            revert RevealTimeoutNotReached(commitId);
        }

        c.status = CommitStatus.TimedOut;
        emit CommitmentTimedOut(commitId);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    /// @notice Compute the result hash for a given commitment (only after reveal)
    /// @param commitId The commitment ID
    /// @param playerSeed The player's original seed
    /// @return The deterministic result hash
    function getResult(uint256 commitId, bytes32 playerSeed) external view returns (bytes32) {
        Commitment storage c = commitments[commitId];
        if (c.status != CommitStatus.Revealed) {
            revert InvalidCommitStatus(commitId, c.status, CommitStatus.Revealed);
        }
        return keccak256(abi.encodePacked(playerSeed, c.serverSeed, commitId));
    }

    /// @notice Get commitment status
    function getCommitStatus(uint256 commitId) external view returns (CommitStatus) {
        return commitments[commitId].status;
    }

    /// @notice Check if a commitment has timed out (but not yet marked)
    function isTimedOut(uint256 commitId) external view returns (bool) {
        Commitment storage c = commitments[commitId];
        return c.status == CommitStatus.Committed && block.timestamp >= c.commitTimestamp + revealTimeout;
    }

    /// @notice Get commitment details
    function getCommitment(uint256 commitId)
        external
        view
        returns (
            address player,
            address game,
            bytes32 playerCommitHash,
            bytes32 serverSeed,
            uint256 betId,
            uint256 commitBlock,
            uint256 commitTimestamp,
            CommitStatus status
        )
    {
        Commitment storage c = commitments[commitId];
        return (c.player, c.game, c.playerCommitHash, c.serverSeed, c.betId, c.commitBlock, c.commitTimestamp, c.status);
    }
}
