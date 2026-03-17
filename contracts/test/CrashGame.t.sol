// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {HouseVault} from "../src/core/HouseVault.sol";
import {SessionManager} from "../src/core/SessionManager.sol";
import {FeeCollector} from "../src/periphery/FeeCollector.sol";
import {Leaderboard} from "../src/periphery/Leaderboard.sol";
import {CrashGame} from "../src/games/CrashGame.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Test", "TEST") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CrashGameTest is Test {
    MockToken public token;
    HouseVault public vault;
    SessionManager public sessionManager;
    FeeCollector public feeCollector;
    Leaderboard public leaderboard;
    CrashGame public crashGame;

    address public owner = address(this);
    address public operator = makeAddr("operator");
    address public treasury = makeAddr("treasury");
    address public player1 = makeAddr("player1");
    address public player2 = makeAddr("player2");
    address public player3 = makeAddr("player3");

    uint256 constant BANKROLL = 1_000_000e18;
    uint256 constant BETTING_DURATION = 30; // 30 seconds

    function setUp() public {
        token = new MockToken();

        vault = new HouseVault(IERC20(address(token)));
        sessionManager = new SessionManager();
        feeCollector = new FeeCollector(IERC20(address(token)), treasury, address(vault), 50, 5000);
        leaderboard = new Leaderboard();

        crashGame = new CrashGame(
            IERC20(address(token)),
            vault,
            sessionManager,
            feeCollector,
            leaderboard,
            operator,
            BETTING_DURATION
        );

        // Authorize
        vault.authorizeGame(address(crashGame));
        feeCollector.authorizeGame(address(crashGame));
        leaderboard.authorizeGame(address(crashGame));
        sessionManager.registerGame(address(crashGame));

        // Fund vault
        token.mint(address(this), BANKROLL);
        token.approve(address(vault), BANKROLL);
        vault.deposit(BANKROLL, address(this));

        // Fund players
        _fundPlayer(player1, 100_000e18);
        _fundPlayer(player2, 100_000e18);
        _fundPlayer(player3, 100_000e18);
    }

    function _fundPlayer(address p, uint256 amount) internal {
        token.mint(p, amount);
        vm.prank(p);
        token.approve(address(crashGame), type(uint256).max);
    }

    // ──────────────────────────────────────────────
    // Round lifecycle
    // ──────────────────────────────────────────────

    function test_startRound() public {
        bytes32 serverSeed = bytes32(uint256(12345));
        bytes32 commitHash = keccak256(abi.encodePacked(serverSeed));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        CrashGame.Round memory round = crashGame.getRound(roundId);
        assertEq(round.roundId, 1);
        assertEq(uint8(round.status), uint8(CrashGame.RoundStatus.Betting));
        assertEq(round.serverCommitHash, commitHash);
        assertEq(round.bettingEndTime, block.timestamp + BETTING_DURATION);
    }

    function test_startRound_revertNotOperator() public {
        vm.prank(player1);
        vm.expectRevert(CrashGame.NotOperator.selector);
        crashGame.startRound(bytes32(uint256(1)));
    }

    function test_startRound_revertPaused() public {
        crashGame.setPaused(true);

        vm.prank(operator);
        vm.expectRevert(CrashGame.GamePaused.selector);
        crashGame.startRound(bytes32(uint256(1)));
    }

    // ──────────────────────────────────────────────
    // Betting
    // ──────────────────────────────────────────────

    function test_placeBet() public {
        bytes32 serverSeed = bytes32(uint256(12345));
        bytes32 commitHash = keccak256(abi.encodePacked(serverSeed));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);

        CrashGame.PlayerBet memory pb = crashGame.getPlayerBet(roundId, player1);
        assertEq(pb.player, player1);
        assertEq(pb.amount, 995e18); // minus fee
        assertFalse(pb.cashedOut);
    }

    function test_placeBet_multiplePlayers() public {
        bytes32 serverSeed = bytes32(uint256(12345));
        bytes32 commitHash = keccak256(abi.encodePacked(serverSeed));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);

        vm.prank(player2);
        crashGame.placeBet(roundId, 2_000e18);

        CrashGame.Round memory round = crashGame.getRound(roundId);
        assertEq(round.playerCount, 2);
    }

    function test_placeBet_revertAfterBettingWindow() public {
        bytes32 commitHash = keccak256(abi.encodePacked(bytes32(uint256(1))));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.warp(block.timestamp + BETTING_DURATION);

        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSelector(CrashGame.BettingWindowClosed.selector, roundId));
        crashGame.placeBet(roundId, 1_000e18);
    }

    function test_placeBet_revertAlreadyBet() public {
        bytes32 commitHash = keccak256(abi.encodePacked(bytes32(uint256(1))));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);

        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSelector(CrashGame.AlreadyBet.selector, roundId, player1));
        crashGame.placeBet(roundId, 1_000e18);
    }

    function test_placeBet_revertZeroAmount() public {
        bytes32 commitHash = keccak256(abi.encodePacked(bytes32(uint256(1))));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        vm.expectRevert(CrashGame.ZeroAmount.selector);
        crashGame.placeBet(roundId, 0);
    }

    // ──────────────────────────────────────────────
    // Cash out
    // ──────────────────────────────────────────────

    function test_cashOut() public {
        bytes32 serverSeed = bytes32(uint256(12345));
        bytes32 commitHash = keccak256(abi.encodePacked(serverSeed));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);

        // Advance past betting window and begin round
        vm.warp(block.timestamp + BETTING_DURATION);
        vm.prank(operator);
        crashGame.beginRound(roundId);

        // Player cashes out at 1.5x
        vm.prank(player1);
        crashGame.cashOut(roundId, 15_000);

        CrashGame.PlayerBet memory pb = crashGame.getPlayerBet(roundId, player1);
        assertTrue(pb.cashedOut);
        assertEq(pb.cashOutMultiplierBps, 15_000);
    }

    function test_cashOut_revertNotRunning() public {
        bytes32 commitHash = keccak256(abi.encodePacked(bytes32(uint256(1))));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);

        // Try to cash out while still in betting phase
        vm.prank(player1);
        vm.expectRevert(
            abi.encodeWithSelector(
                CrashGame.RoundNotInStatus.selector,
                roundId,
                CrashGame.RoundStatus.Running,
                CrashGame.RoundStatus.Betting
            )
        );
        crashGame.cashOut(roundId, 15_000);
    }

    function test_cashOut_revertNoBet() public {
        bytes32 commitHash = keccak256(abi.encodePacked(bytes32(uint256(1))));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.warp(block.timestamp + BETTING_DURATION);
        vm.prank(operator);
        crashGame.beginRound(roundId);

        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSelector(CrashGame.NoBetFound.selector, roundId, player1));
        crashGame.cashOut(roundId, 15_000);
    }

    function test_cashOut_revertAlreadyCashedOut() public {
        bytes32 commitHash = keccak256(abi.encodePacked(bytes32(uint256(1))));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);

        vm.warp(block.timestamp + BETTING_DURATION);
        vm.prank(operator);
        crashGame.beginRound(roundId);

        vm.prank(player1);
        crashGame.cashOut(roundId, 15_000);

        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSelector(CrashGame.AlreadyCashedOut.selector, roundId, player1));
        crashGame.cashOut(roundId, 15_000);
    }

    // ──────────────────────────────────────────────
    // Crash resolution
    // ──────────────────────────────────────────────

    function test_fullRound_playerWins() public {
        bytes32 serverSeed = bytes32(uint256(12345));
        bytes32 commitHash = keccak256(abi.encodePacked(serverSeed));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);

        vm.warp(block.timestamp + BETTING_DURATION);
        vm.prank(operator);
        crashGame.beginRound(roundId);

        // Compute crash point to know what multiplier to cash out at
        uint256 crashBps = crashGame.verifyCrashPoint(serverSeed, roundId);

        // Cash out below crash point (at 1.00x minimum to guarantee win)
        uint256 safeMultiplier = 10_000; // 1.00x
        if (crashBps > 10_000) {
            safeMultiplier = 10_000; // Just use 1.00x to guarantee win
        }

        uint256 player1BalBefore = token.balanceOf(player1);

        vm.prank(player1);
        crashGame.cashOut(roundId, safeMultiplier);

        // Crash the round
        vm.prank(operator);
        crashGame.crashRound(roundId, serverSeed);

        CrashGame.PlayerBet memory pb = crashGame.getPlayerBet(roundId, player1);

        if (safeMultiplier <= crashBps) {
            // Player won
            assertGt(pb.payout, 0);
            assertGt(token.balanceOf(player1), player1BalBefore);
        }
    }

    function test_fullRound_playerLoses_noCashout() public {
        bytes32 serverSeed = bytes32(uint256(12345));
        bytes32 commitHash = keccak256(abi.encodePacked(serverSeed));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);

        vm.warp(block.timestamp + BETTING_DURATION);
        vm.prank(operator);
        crashGame.beginRound(roundId);

        // Don't cash out - just crash
        vm.prank(operator);
        crashGame.crashRound(roundId, serverSeed);

        CrashGame.PlayerBet memory pb = crashGame.getPlayerBet(roundId, player1);
        assertEq(pb.payout, 0);
    }

    function test_crashRound_invalidSeed() public {
        bytes32 serverSeed = bytes32(uint256(12345));
        bytes32 commitHash = keccak256(abi.encodePacked(serverSeed));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.warp(block.timestamp + BETTING_DURATION);
        vm.prank(operator);
        crashGame.beginRound(roundId);

        // Try with wrong seed
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(CrashGame.InvalidServerSeed.selector, roundId));
        crashGame.crashRound(roundId, bytes32(uint256(99999)));
    }

    // ──────────────────────────────────────────────
    // Cancel round
    // ──────────────────────────────────────────────

    function test_cancelRound_refunds() public {
        bytes32 commitHash = keccak256(abi.encodePacked(bytes32(uint256(1))));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);

        uint256 player1BalBefore = token.balanceOf(player1);

        vm.prank(operator);
        crashGame.cancelRound(roundId);

        CrashGame.Round memory round = crashGame.getRound(roundId);
        assertEq(uint8(round.status), uint8(CrashGame.RoundStatus.Cancelled));

        // Player should get refund (net amount after fee)
        assertEq(token.balanceOf(player1) - player1BalBefore, 995e18);
    }

    // ──────────────────────────────────────────────
    // Multiple players in a round
    // ──────────────────────────────────────────────

    function test_multiplePlayersRound() public {
        bytes32 serverSeed = bytes32(uint256(42));
        bytes32 commitHash = keccak256(abi.encodePacked(serverSeed));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        // Three players bet
        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);
        vm.prank(player2);
        crashGame.placeBet(roundId, 2_000e18);
        vm.prank(player3);
        crashGame.placeBet(roundId, 500e18);

        vm.warp(block.timestamp + BETTING_DURATION);
        vm.prank(operator);
        crashGame.beginRound(roundId);

        uint256 crashBps = crashGame.verifyCrashPoint(serverSeed, roundId);

        // Player 1 cashes out at 1.00x (should win if crash > 1.00x)
        vm.prank(player1);
        crashGame.cashOut(roundId, 10_000);

        // Player 2 cashes out at a very high multiplier (likely above crash)
        vm.prank(player2);
        crashGame.cashOut(roundId, crashBps + 10_000);

        // Player 3 doesn't cash out

        vm.prank(operator);
        crashGame.crashRound(roundId, serverSeed);

        CrashGame.PlayerBet[] memory allBets = crashGame.getRoundPlayers(roundId);
        assertEq(allBets.length, 3);

        // Player 1 should have won (cashed out at 1.00x which is <= any crash point)
        CrashGame.PlayerBet memory pb1 = crashGame.getPlayerBet(roundId, player1);
        if (crashBps >= 10_000) {
            assertGt(pb1.payout, 0);
        }

        // Player 2 cashed out above crash - should lose
        CrashGame.PlayerBet memory pb2 = crashGame.getPlayerBet(roundId, player2);
        assertEq(pb2.payout, 0);

        // Player 3 didn't cash out - should lose
        CrashGame.PlayerBet memory pb3 = crashGame.getPlayerBet(roundId, player3);
        assertEq(pb3.payout, 0);
    }

    // ──────────────────────────────────────────────
    // Crash point verification
    // ──────────────────────────────────────────────

    function test_verifyCrashPoint_deterministic() public view {
        bytes32 seed = bytes32(uint256(42));
        uint256 point1 = crashGame.verifyCrashPoint(seed, 1);
        uint256 point2 = crashGame.verifyCrashPoint(seed, 1);
        assertEq(point1, point2);
    }

    function test_verifyCrashPoint_differentPerRound() public view {
        bytes32 seed = bytes32(uint256(42));
        uint256 point1 = crashGame.verifyCrashPoint(seed, 1);
        uint256 point2 = crashGame.verifyCrashPoint(seed, 2);
        // Very unlikely to be equal
        assertTrue(point1 != point2);
    }

    function test_crashPoint_minimumOneX() public view {
        // Test several seeds to verify crash point is always >= 1.00x (10000 BPS)
        for (uint256 i = 0; i < 100; i++) {
            bytes32 seed = bytes32(i);
            uint256 point = crashGame.verifyCrashPoint(seed, 1);
            assertGe(point, 10_000); // >= 1.00x
        }
    }

    // ──────────────────────────────────────────────
    // Leaderboard integration
    // ──────────────────────────────────────────────

    function test_leaderboard_updated() public {
        bytes32 serverSeed = bytes32(uint256(42));
        bytes32 commitHash = keccak256(abi.encodePacked(serverSeed));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(player1);
        crashGame.placeBet(roundId, 1_000e18);

        vm.warp(block.timestamp + BETTING_DURATION);
        vm.prank(operator);
        crashGame.beginRound(roundId);

        vm.prank(operator);
        crashGame.crashRound(roundId, serverSeed);

        Leaderboard.PlayerStats memory stats = leaderboard.getPlayerStats(player1);
        assertEq(stats.gamesPlayed, 1);
        assertGt(stats.totalWagered, 0);
    }

    // ──────────────────────────────────────────────
    // Operator management
    // ──────────────────────────────────────────────

    function test_setOperator() public {
        address newOp = makeAddr("newOp");
        crashGame.setOperator(newOp);
        assertEq(crashGame.operator(), newOp);
    }

    function test_setOperator_revertNotOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        crashGame.setOperator(player1);
    }

    function test_setOperator_revertZeroAddress() public {
        vm.expectRevert(CrashGame.ZeroAddress.selector);
        crashGame.setOperator(address(0));
    }

    // ──────────────────────────────────────────────
    // Edge cases
    // ──────────────────────────────────────────────

    function test_beginRound_revertTooEarly() public {
        bytes32 commitHash = keccak256(abi.encodePacked(bytes32(uint256(1))));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(CrashGame.BettingWindowNotClosed.selector, roundId));
        crashGame.beginRound(roundId);
    }

    function test_crashRound_revertNotRunning() public {
        bytes32 serverSeed = bytes32(uint256(1));
        bytes32 commitHash = keccak256(abi.encodePacked(serverSeed));

        vm.prank(operator);
        uint256 roundId = crashGame.startRound(commitHash);

        // Try to crash while still in betting phase
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                CrashGame.RoundNotInStatus.selector,
                roundId,
                CrashGame.RoundStatus.Running,
                CrashGame.RoundStatus.Betting
            )
        );
        crashGame.crashRound(roundId, serverSeed);
    }

    // ──────────────────────────────────────────────
    // Fuzz tests
    // ──────────────────────────────────────────────

    function testFuzz_crashPoint_alwaysAboveMinimum(bytes32 seed, uint256 roundId) public view {
        roundId = bound(roundId, 1, 1_000_000);
        uint256 point = crashGame.verifyCrashPoint(seed, roundId);
        assertGe(point, 10_000);
    }
}
