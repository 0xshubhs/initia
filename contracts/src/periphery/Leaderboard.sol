// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title Leaderboard
/// @notice On-chain leaderboard tracking player stats across all games.
///         Tracks total wagered, total won, biggest win, and games played.
///         Sortable by different metrics via view functions.
/// @dev Only authorized game contracts can update stats.
contract Leaderboard is Ownable2Step {
    // ──────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────

    struct PlayerStats {
        uint256 totalWagered;
        uint256 totalWon;
        uint256 totalLost;
        uint256 biggestWin;
        uint256 gamesPlayed;
        uint256 gamesWon;
    }

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    /// @notice Player stats mapping
    mapping(address => PlayerStats) public playerStats;

    /// @notice All players who have ever played (for enumeration)
    address[] public allPlayers;

    /// @notice Whether a player has been registered
    mapping(address => bool) public isRegistered;

    /// @notice Authorized game contracts
    mapping(address => bool) public authorizedGames;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event StatsUpdated(
        address indexed player,
        uint256 wagered,
        uint256 won,
        bool isWin
    );
    event GameAuthorized(address indexed game);
    event GameRevoked(address indexed game);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error NotAuthorizedGame();
    error ZeroAddress();
    error InvalidRange();

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

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

    // ──────────────────────────────────────────────
    // Game interface
    // ──────────────────────────────────────────────

    /// @notice Record a completed game for a player
    /// @param player The player address
    /// @param wagered The amount wagered
    /// @param payout The amount won (0 if lost). This is the total payout including original bet.
    function recordGame(address player, uint256 wagered, uint256 payout) external {
        if (!authorizedGames[msg.sender]) revert NotAuthorizedGame();

        if (!isRegistered[player]) {
            isRegistered[player] = true;
            allPlayers.push(player);
        }

        PlayerStats storage stats = playerStats[player];
        stats.totalWagered += wagered;
        stats.gamesPlayed++;

        bool isWin = payout > 0;
        if (isWin) {
            stats.totalWon += payout;
            stats.gamesWon++;
            // Net win = payout - wagered
            uint256 netWin = payout > wagered ? payout - wagered : 0;
            if (netWin > stats.biggestWin) {
                stats.biggestWin = netWin;
            }
        } else {
            stats.totalLost += wagered;
        }

        emit StatsUpdated(player, wagered, payout, isWin);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    /// @notice Get stats for a single player
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    /// @notice Get total number of players
    function totalPlayers() external view returns (uint256) {
        return allPlayers.length;
    }

    /// @notice Get top N players by total wagered
    /// @param n Number of top players to return
    /// @return players The addresses sorted by total wagered (descending)
    /// @return stats The stats for each player
    function topByWagered(uint256 n) external view returns (address[] memory players, PlayerStats[] memory stats) {
        return _getTopN(n, _compareByWagered);
    }

    /// @notice Get top N players by total won
    function topByWon(uint256 n) external view returns (address[] memory players, PlayerStats[] memory stats) {
        return _getTopN(n, _compareByWon);
    }

    /// @notice Get top N players by biggest single win
    function topByBiggestWin(uint256 n) external view returns (address[] memory players, PlayerStats[] memory stats) {
        return _getTopN(n, _compareByBiggestWin);
    }

    /// @notice Get top N players by games played
    function topByGamesPlayed(uint256 n) external view returns (address[] memory players, PlayerStats[] memory stats) {
        return _getTopN(n, _compareByGamesPlayed);
    }

    /// @notice Get net profit/loss for a player (can be negative)
    function getNetPnL(address player) external view returns (int256) {
        PlayerStats storage s = playerStats[player];
        return int256(s.totalWon) - int256(s.totalWagered);
    }

    /// @notice Get player win rate in basis points (10000 = 100%)
    function getWinRate(address player) external view returns (uint256) {
        PlayerStats storage s = playerStats[player];
        if (s.gamesPlayed == 0) return 0;
        return (s.gamesWon * 10_000) / s.gamesPlayed;
    }

    // ──────────────────────────────────────────────
    // Internal sorting helpers
    // ──────────────────────────────────────────────

    /// @dev Comparison function type
    function _compareByWagered(address a, address b) internal view returns (bool) {
        return playerStats[a].totalWagered > playerStats[b].totalWagered;
    }

    function _compareByWon(address a, address b) internal view returns (bool) {
        return playerStats[a].totalWon > playerStats[b].totalWon;
    }

    function _compareByBiggestWin(address a, address b) internal view returns (bool) {
        return playerStats[a].biggestWin > playerStats[b].biggestWin;
    }

    function _compareByGamesPlayed(address a, address b) internal view returns (bool) {
        return playerStats[a].gamesPlayed > playerStats[b].gamesPlayed;
    }

    /// @dev Get top N players using a comparison function (simple insertion sort for small N)
    function _getTopN(uint256 n, function(address, address) internal view returns (bool) compare)
        internal
        view
        returns (address[] memory players, PlayerStats[] memory stats)
    {
        uint256 total = allPlayers.length;
        uint256 count = n > total ? total : n;

        players = new address[](count);
        stats = new PlayerStats[](count);

        if (count == 0) return (players, stats);

        // Simple selection approach for top N: maintain a sorted array of size N
        // For each player, check if they should be inserted
        uint256 filled = 0;

        for (uint256 i = 0; i < total; i++) {
            address candidate = allPlayers[i];

            if (filled < count) {
                // Still have space, insert in sorted position
                uint256 insertPos = filled;
                for (uint256 j = 0; j < filled; j++) {
                    if (compare(candidate, players[j])) {
                        insertPos = j;
                        break;
                    }
                }
                // Shift elements right
                for (uint256 j = filled; j > insertPos; j--) {
                    players[j] = players[j - 1];
                    stats[j] = stats[j - 1];
                }
                players[insertPos] = candidate;
                stats[insertPos] = playerStats[candidate];
                filled++;
            } else if (compare(candidate, players[count - 1])) {
                // Candidate is better than the worst in our top N
                uint256 insertPos = count - 1;
                for (uint256 j = 0; j < count - 1; j++) {
                    if (compare(candidate, players[j])) {
                        insertPos = j;
                        break;
                    }
                }
                // Shift elements right, dropping the last
                for (uint256 j = count - 1; j > insertPos; j--) {
                    players[j] = players[j - 1];
                    stats[j] = stats[j - 1];
                }
                players[insertPos] = candidate;
                stats[insertPos] = playerStats[candidate];
            }
        }
    }
}
