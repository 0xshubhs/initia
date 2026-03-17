// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {HouseVault} from "../src/core/HouseVault.sol";
import {RandomnessProvider} from "../src/core/RandomnessProvider.sol";
import {SessionManager} from "../src/core/SessionManager.sol";
import {FeeCollector} from "../src/periphery/FeeCollector.sol";
import {Leaderboard} from "../src/periphery/Leaderboard.sol";
import {CoinFlip} from "../src/games/CoinFlip.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Test", "TEST") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CoinFlipTest is Test {
    MockToken public token;
    HouseVault public vault;
    RandomnessProvider public randomness;
    SessionManager public sessionManager;
    FeeCollector public feeCollector;
    Leaderboard public leaderboard;
    CoinFlip public coinFlip;

    address public owner = address(this);
    address public houseOperator = makeAddr("operator");
    address public treasury = makeAddr("treasury");
    address public player = makeAddr("player");
    address public delegate = makeAddr("delegate");

    uint256 constant REVEAL_TIMEOUT = 300;
    uint256 constant FEE_BPS = 50; // 0.5%
    uint256 constant BANKROLL = 1_000_000e18;

    function setUp() public {
        token = new MockToken();

        vault = new HouseVault(IERC20(address(token)));
        randomness = new RandomnessProvider(houseOperator, REVEAL_TIMEOUT);
        sessionManager = new SessionManager();
        feeCollector = new FeeCollector(IERC20(address(token)), treasury, address(vault), FEE_BPS, 5000);
        leaderboard = new Leaderboard();

        coinFlip = new CoinFlip(
            IERC20(address(token)),
            vault,
            randomness,
            sessionManager,
            feeCollector,
            leaderboard
        );

        // Authorize
        vault.authorizeGame(address(coinFlip));
        randomness.authorizeGame(address(coinFlip));
        feeCollector.authorizeGame(address(coinFlip));
        leaderboard.authorizeGame(address(coinFlip));
        sessionManager.registerGame(address(coinFlip));

        // Fund vault (bankroll)
        token.mint(address(this), BANKROLL);
        token.approve(address(vault), BANKROLL);
        vault.deposit(BANKROLL, address(this));

        // Fund player
        token.mint(player, 100_000e18);
        vm.prank(player);
        token.approve(address(coinFlip), type(uint256).max);
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    function _placeBet(uint256 amount, CoinFlip.Choice choice, bytes32 playerSeed)
        internal
        returns (uint256 betId, uint256 commitId)
    {
        bytes32 commitHash = keccak256(abi.encodePacked(playerSeed));

        vm.prank(player);
        betId = coinFlip.placeBet(amount, choice, commitHash);

        CoinFlip.Bet memory bet = coinFlip.getBet(betId);
        commitId = bet.commitId;
    }

    function _revealAndResolve(uint256 betId, uint256 commitId, bytes32 playerSeed, bytes32 serverSeed) internal {
        vm.prank(houseOperator);
        randomness.reveal(commitId, serverSeed, playerSeed);

        coinFlip.resolveBet(betId, playerSeed);
    }

    // ──────────────────────────────────────────────
    // Placement tests
    // ──────────────────────────────────────────────

    function test_placeBet_basic() public {
        bytes32 playerSeed = bytes32(uint256(12345));
        (uint256 betId,) = _placeBet(1_000e18, CoinFlip.Choice.Heads, playerSeed);

        CoinFlip.Bet memory bet = coinFlip.getBet(betId);
        assertEq(bet.player, player);
        // Net bet = 1000 - 0.5% fee = 995
        assertEq(bet.amount, 995e18);
        assertEq(bet.feeAmount, 5e18);
        assertEq(uint8(bet.choice), uint8(CoinFlip.Choice.Heads));
        assertEq(uint8(bet.status), uint8(CoinFlip.BetStatus.Pending));
    }

    function test_placeBet_emitsEvent() public {
        bytes32 playerSeed = bytes32(uint256(12345));
        bytes32 commitHash = keccak256(abi.encodePacked(playerSeed));

        vm.prank(player);
        vm.expectEmit(true, true, false, false);
        emit CoinFlip.BetPlaced(0, player, 995e18, CoinFlip.Choice.Heads, 0);
        coinFlip.placeBet(1_000e18, CoinFlip.Choice.Heads, commitHash);
    }

    function test_placeBet_revertZeroAmount() public {
        vm.prank(player);
        vm.expectRevert(CoinFlip.ZeroAmount.selector);
        coinFlip.placeBet(0, CoinFlip.Choice.Heads, bytes32(0));
    }

    function test_placeBet_revertTooLarge() public {
        // Max bet = 1_000_000 / 50 = 20_000
        vm.prank(player);
        vm.expectRevert(
            abi.encodeWithSelector(CoinFlip.BetTooLarge.selector, 20_001e18, 20_000e18)
        );
        coinFlip.placeBet(20_001e18, CoinFlip.Choice.Heads, bytes32(uint256(1)));
    }

    function test_placeBet_revertWhenPaused() public {
        coinFlip.setPaused(true);

        vm.prank(player);
        vm.expectRevert(CoinFlip.GamePaused.selector);
        coinFlip.placeBet(100e18, CoinFlip.Choice.Heads, bytes32(uint256(1)));
    }

    // ──────────────────────────────────────────────
    // Resolution tests
    // ──────────────────────────────────────────────

    function test_resolveBet_win() public {
        bytes32 playerSeed = bytes32(uint256(42));
        bytes32 serverSeed = bytes32(uint256(99));

        // Pre-compute result to find a winning server seed for Heads
        bytes32 resultHash = keccak256(abi.encodePacked(playerSeed, serverSeed, uint256(0)));
        uint256 result = uint256(resultHash) % 2;
        CoinFlip.Choice expectedChoice = CoinFlip.Choice(result);

        (uint256 betId, uint256 commitId) = _placeBet(1_000e18, expectedChoice, playerSeed);

        uint256 playerBalBefore = token.balanceOf(player);

        _revealAndResolve(betId, commitId, playerSeed, serverSeed);

        CoinFlip.Bet memory bet = coinFlip.getBet(betId);
        assertEq(uint8(bet.status), uint8(CoinFlip.BetStatus.Won));

        // Payout = 995 * 19600 / 10000 = 1950.2 (due to fee deduction from bet)
        uint256 expectedPayout = (995e18 * 19_600) / 10_000;
        assertEq(bet.payout, expectedPayout);
        assertEq(token.balanceOf(player) - playerBalBefore, expectedPayout);
    }

    function test_resolveBet_loss() public {
        bytes32 playerSeed = bytes32(uint256(42));
        bytes32 serverSeed = bytes32(uint256(99));

        // Pre-compute result to find a losing choice
        bytes32 resultHash = keccak256(abi.encodePacked(playerSeed, serverSeed, uint256(0)));
        uint256 result = uint256(resultHash) % 2;
        // Pick the opposite choice
        CoinFlip.Choice losingChoice = result == 0 ? CoinFlip.Choice.Tails : CoinFlip.Choice.Heads;

        (uint256 betId, uint256 commitId) = _placeBet(1_000e18, losingChoice, playerSeed);

        uint256 playerBalBefore = token.balanceOf(player);

        _revealAndResolve(betId, commitId, playerSeed, serverSeed);

        CoinFlip.Bet memory bet = coinFlip.getBet(betId);
        assertEq(uint8(bet.status), uint8(CoinFlip.BetStatus.Lost));
        assertEq(bet.payout, 0);
        assertEq(token.balanceOf(player), playerBalBefore);
    }

    function test_resolveBet_revertNotPending() public {
        bytes32 playerSeed = bytes32(uint256(42));
        bytes32 serverSeed = bytes32(uint256(99));

        bytes32 resultHash = keccak256(abi.encodePacked(playerSeed, serverSeed, uint256(0)));
        uint256 result = uint256(resultHash) % 2;
        CoinFlip.Choice choice = CoinFlip.Choice(result);

        (uint256 betId, uint256 commitId) = _placeBet(1_000e18, choice, playerSeed);
        _revealAndResolve(betId, commitId, playerSeed, serverSeed);

        // Try to resolve again
        vm.expectRevert(abi.encodeWithSelector(CoinFlip.BetNotPending.selector, betId));
        coinFlip.resolveBet(betId, playerSeed);
    }

    // ──────────────────────────────────────────────
    // Timeout tests
    // ──────────────────────────────────────────────

    function test_claimTimeout() public {
        bytes32 playerSeed = bytes32(uint256(42));
        (uint256 betId,) = _placeBet(1_000e18, CoinFlip.Choice.Heads, playerSeed);

        uint256 playerBalBefore = token.balanceOf(player);

        // Advance time past timeout
        vm.warp(block.timestamp + REVEAL_TIMEOUT + 1);

        coinFlip.claimTimeout(betId);

        CoinFlip.Bet memory bet = coinFlip.getBet(betId);
        assertEq(uint8(bet.status), uint8(CoinFlip.BetStatus.Refunded));
        // Refund should be the net bet amount
        assertEq(token.balanceOf(player) - playerBalBefore, 995e18);
    }

    function test_claimTimeout_revertTooEarly() public {
        bytes32 playerSeed = bytes32(uint256(42));
        (uint256 betId,) = _placeBet(1_000e18, CoinFlip.Choice.Heads, playerSeed);

        vm.expectRevert();
        coinFlip.claimTimeout(betId);
    }

    // ──────────────────────────────────────────────
    // Session key tests
    // ──────────────────────────────────────────────

    function test_placeBetWithSession() public {
        // Player creates a session for delegate
        address[] memory games = new address[](1);
        games[0] = address(coinFlip);

        vm.prank(player);
        uint256 sessionId = sessionManager.createSession(
            delegate,
            10_000e18, // max bet
            100_000e18, // spending limit
            block.timestamp + 1 hours,
            games
        );

        // Player must approve the coinFlip contract
        vm.prank(player);
        token.approve(address(coinFlip), type(uint256).max);

        bytes32 playerSeed = bytes32(uint256(100));
        bytes32 commitHash = keccak256(abi.encodePacked(playerSeed));

        // Delegate places bet on behalf of player
        vm.prank(delegate);
        uint256 betId = coinFlip.placeBetWithSession(sessionId, 500e18, CoinFlip.Choice.Tails, commitHash);

        CoinFlip.Bet memory bet = coinFlip.getBet(betId);
        assertEq(bet.player, player); // Bet is attributed to the player, not delegate
    }

    // ──────────────────────────────────────────────
    // Leaderboard integration
    // ──────────────────────────────────────────────

    function test_leaderboard_updated_on_resolve() public {
        bytes32 playerSeed = bytes32(uint256(42));
        bytes32 serverSeed = bytes32(uint256(99));

        bytes32 resultHash = keccak256(abi.encodePacked(playerSeed, serverSeed, uint256(0)));
        uint256 result = uint256(resultHash) % 2;
        CoinFlip.Choice choice = CoinFlip.Choice(result);

        (uint256 betId, uint256 commitId) = _placeBet(1_000e18, choice, playerSeed);
        _revealAndResolve(betId, commitId, playerSeed, serverSeed);

        Leaderboard.PlayerStats memory stats = leaderboard.getPlayerStats(player);
        assertEq(stats.gamesPlayed, 1);
        assertGt(stats.totalWagered, 0);
    }

    // ──────────────────────────────────────────────
    // Fee collection tests
    // ──────────────────────────────────────────────

    function test_fees_collected() public {
        bytes32 playerSeed = bytes32(uint256(42));
        _placeBet(1_000e18, CoinFlip.Choice.Heads, playerSeed);

        // Fee = 1000 * 50 / 10000 = 5
        assertEq(feeCollector.totalFeesCollected(), 5e18);
        assertEq(token.balanceOf(address(feeCollector)), 5e18);
    }

    // ──────────────────────────────────────────────
    // Payout calculation
    // ──────────────────────────────────────────────

    function test_calculatePayout() public view {
        // 1000 * 1.96 = 1960
        assertEq(coinFlip.calculatePayout(1_000e18), 1_960e18);
    }

    // ──────────────────────────────────────────────
    // Fuzz tests
    // ──────────────────────────────────────────────

    function testFuzz_placeBet_validAmounts(uint256 amount) public {
        uint256 maxBetAmount = vault.maxBet();
        amount = bound(amount, 1, maxBetAmount);

        // Ensure player has enough
        token.mint(player, amount);
        vm.prank(player);
        token.approve(address(coinFlip), amount);

        bytes32 playerSeed = bytes32(amount);
        bytes32 commitHash = keccak256(abi.encodePacked(playerSeed));

        vm.prank(player);
        uint256 betId = coinFlip.placeBet(amount, CoinFlip.Choice.Heads, commitHash);

        CoinFlip.Bet memory bet = coinFlip.getBet(betId);
        assertEq(uint8(bet.status), uint8(CoinFlip.BetStatus.Pending));
        assertEq(bet.player, player);
    }

    function testFuzz_resolveMultipleBets(uint8 seedVal) public {
        bytes32 playerSeed = bytes32(uint256(seedVal));
        bytes32 serverSeed = bytes32(uint256(seedVal) + 1000);

        bytes32 resultHash = keccak256(abi.encodePacked(playerSeed, serverSeed, uint256(0)));
        uint256 result = uint256(resultHash) % 2;
        CoinFlip.Choice choice = CoinFlip.Choice(result);

        (uint256 betId, uint256 commitId) = _placeBet(100e18, choice, playerSeed);
        _revealAndResolve(betId, commitId, playerSeed, serverSeed);

        CoinFlip.Bet memory bet = coinFlip.getBet(betId);
        // Should always be Won since we picked the correct choice
        assertEq(uint8(bet.status), uint8(CoinFlip.BetStatus.Won));
    }

    // ──────────────────────────────────────────────
    // Commit-reveal end-to-end
    // ──────────────────────────────────────────────

    function test_commitReveal_fullFlow() public {
        // 1. Player picks a seed and commits its hash
        bytes32 playerSeed = bytes32(uint256(0xDEADBEEF));
        bytes32 commitHash = keccak256(abi.encodePacked(playerSeed));

        vm.prank(player);
        uint256 betId = coinFlip.placeBet(1_000e18, CoinFlip.Choice.Heads, commitHash);

        CoinFlip.Bet memory bet = coinFlip.getBet(betId);
        uint256 commitId = bet.commitId;

        // 2. House reveals server seed
        bytes32 serverSeed = bytes32(uint256(0xCAFEBABE));

        vm.prank(houseOperator);
        bytes32 resultHash = randomness.reveal(commitId, serverSeed, playerSeed);

        // 3. Anyone can resolve the bet now
        coinFlip.resolveBet(betId, playerSeed);

        // 4. Verify the result is deterministic
        bytes32 expectedResult = keccak256(abi.encodePacked(playerSeed, serverSeed, commitId));
        assertEq(resultHash, expectedResult);

        bet = coinFlip.getBet(betId);
        assertTrue(
            uint8(bet.status) == uint8(CoinFlip.BetStatus.Won) ||
            uint8(bet.status) == uint8(CoinFlip.BetStatus.Lost)
        );
    }
}
