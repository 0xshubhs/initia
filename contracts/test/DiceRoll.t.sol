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
import {DiceRoll} from "../src/games/DiceRoll.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Test", "TEST") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DiceRollTest is Test {
    MockToken public token;
    HouseVault public vault;
    RandomnessProvider public randomness;
    SessionManager public sessionManager;
    FeeCollector public feeCollector;
    Leaderboard public leaderboard;
    DiceRoll public diceRoll;

    address public owner = address(this);
    address public houseOperator = makeAddr("operator");
    address public treasury = makeAddr("treasury");
    address public player = makeAddr("player");

    uint256 constant REVEAL_TIMEOUT = 300;
    uint256 constant FEE_BPS = 50;
    uint256 constant BANKROLL = 1_000_000e18;

    function setUp() public {
        token = new MockToken();

        vault = new HouseVault(IERC20(address(token)));
        randomness = new RandomnessProvider(houseOperator, REVEAL_TIMEOUT);
        sessionManager = new SessionManager();
        feeCollector = new FeeCollector(IERC20(address(token)), treasury, address(vault), FEE_BPS, 5000);
        leaderboard = new Leaderboard();

        diceRoll = new DiceRoll(
            IERC20(address(token)),
            vault,
            randomness,
            sessionManager,
            feeCollector,
            leaderboard
        );

        // Authorize
        vault.authorizeGame(address(diceRoll));
        randomness.authorizeGame(address(diceRoll));
        feeCollector.authorizeGame(address(diceRoll));
        leaderboard.authorizeGame(address(diceRoll));
        sessionManager.registerGame(address(diceRoll));

        // Fund vault
        token.mint(address(this), BANKROLL);
        token.approve(address(vault), BANKROLL);
        vault.deposit(BANKROLL, address(this));

        // Fund player
        token.mint(player, 100_000e18);
        vm.prank(player);
        token.approve(address(diceRoll), type(uint256).max);
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    function _placeBet(uint256 amount, uint256 chosenNumber, bytes32 playerSeed)
        internal
        returns (uint256 betId, uint256 commitId)
    {
        bytes32 commitHash = keccak256(abi.encodePacked(playerSeed));

        vm.prank(player);
        betId = diceRoll.placeBet(amount, chosenNumber, commitHash);

        DiceRoll.Bet memory bet = diceRoll.getBet(betId);
        commitId = bet.commitId;
    }

    function _revealAndResolve(uint256 betId, uint256 commitId, bytes32 playerSeed, bytes32 serverSeed) internal {
        vm.prank(houseOperator);
        randomness.reveal(commitId, serverSeed, playerSeed);

        diceRoll.resolveBet(betId, playerSeed);
    }

    // ──────────────────────────────────────────────
    // Multiplier calculation tests
    // ──────────────────────────────────────────────

    function test_multiplier_choice50() public view {
        // Pick 50: payout = 100 * 9800 / 50 = 19600 BPS = 1.96x
        uint256 mult = diceRoll.getMultiplierBps(50);
        assertEq(mult, 19_600);
    }

    function test_multiplier_choice10() public view {
        // Pick 10: payout = 100 * 9800 / 10 = 98000 BPS = 9.80x
        uint256 mult = diceRoll.getMultiplierBps(10);
        assertEq(mult, 98_000);
    }

    function test_multiplier_choice2() public view {
        // Pick 2: payout = 100 * 9800 / 2 = 490000 BPS = 49x
        uint256 mult = diceRoll.getMultiplierBps(2);
        assertEq(mult, 490_000);
    }

    function test_multiplier_choice100() public view {
        // Pick 100: payout = 100 * 9800 / 100 = 9800 BPS = 0.98x
        uint256 mult = diceRoll.getMultiplierBps(100);
        assertEq(mult, 9_800);
    }

    function test_calculatePayout_choice50() public view {
        // 1000 * 19600 / 10000 = 1960
        uint256 payout = diceRoll.calculatePayout(1_000e18, 50);
        assertEq(payout, 1_960e18);
    }

    function test_winProbability() public view {
        // Choice 50: win if roll < 50, so 49 winning outcomes / 100 = 4900 BPS
        assertEq(diceRoll.getWinProbabilityBps(50), 4_900);
        // Choice 10: 9 winning outcomes / 100 = 900 BPS
        assertEq(diceRoll.getWinProbabilityBps(10), 900);
        // Choice 100: 99 winning outcomes / 100 = 9900 BPS
        assertEq(diceRoll.getWinProbabilityBps(100), 9_900);
    }

    // ──────────────────────────────────────────────
    // Placement tests
    // ──────────────────────────────────────────────

    function test_placeBet_basic() public {
        bytes32 playerSeed = bytes32(uint256(42));
        (uint256 betId,) = _placeBet(1_000e18, 50, playerSeed);

        DiceRoll.Bet memory bet = diceRoll.getBet(betId);
        assertEq(bet.player, player);
        assertEq(bet.amount, 995e18); // minus 0.5% fee
        assertEq(bet.chosenNumber, 50);
        assertEq(uint8(bet.status), uint8(DiceRoll.BetStatus.Pending));
    }

    function test_placeBet_revertInvalidChoice_low() public {
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(DiceRoll.InvalidChoice.selector, 1));
        diceRoll.placeBet(100e18, 1, bytes32(uint256(1)));
    }

    function test_placeBet_revertInvalidChoice_high() public {
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(DiceRoll.InvalidChoice.selector, 101));
        diceRoll.placeBet(100e18, 101, bytes32(uint256(1)));
    }

    function test_placeBet_revertZero() public {
        vm.prank(player);
        vm.expectRevert(DiceRoll.ZeroAmount.selector);
        diceRoll.placeBet(0, 50, bytes32(uint256(1)));
    }

    function test_placeBet_revertTooLarge_highMultiplier() public {
        // With choice 2, multiplier is 49x
        // Max bet = bankroll * 10000 / (50 * 490000) = 1_000_000 * 10000 / 24_500_000 ~ 408.16
        uint256 maxBetChoice2 = diceRoll.getMaxBet(2);

        vm.prank(player);
        vm.expectRevert(
            abi.encodeWithSelector(DiceRoll.BetTooLarge.selector, maxBetChoice2 + 1e18, maxBetChoice2)
        );
        diceRoll.placeBet(maxBetChoice2 + 1e18, 2, bytes32(uint256(1)));
    }

    // ──────────────────────────────────────────────
    // Resolution tests
    // ──────────────────────────────────────────────

    function test_resolveBet_deterministic() public {
        bytes32 playerSeed = bytes32(uint256(42));
        bytes32 serverSeed = bytes32(uint256(99));

        (uint256 betId, uint256 commitId) = _placeBet(1_000e18, 50, playerSeed);

        // Pre-compute expected roll
        bytes32 resultHash = keccak256(abi.encodePacked(playerSeed, serverSeed, commitId));
        uint256 expectedRoll = (uint256(resultHash) % 100) + 1;

        _revealAndResolve(betId, commitId, playerSeed, serverSeed);

        DiceRoll.Bet memory bet = diceRoll.getBet(betId);
        assertEq(bet.rolledNumber, expectedRoll);

        if (expectedRoll < 50) {
            assertEq(uint8(bet.status), uint8(DiceRoll.BetStatus.Won));
            assertGt(bet.payout, 0);
        } else {
            assertEq(uint8(bet.status), uint8(DiceRoll.BetStatus.Lost));
            assertEq(bet.payout, 0);
        }
    }

    // ──────────────────────────────────────────────
    // Timeout tests
    // ──────────────────────────────────────────────

    function test_claimTimeout() public {
        bytes32 playerSeed = bytes32(uint256(42));
        (uint256 betId,) = _placeBet(1_000e18, 50, playerSeed);

        uint256 playerBalBefore = token.balanceOf(player);

        vm.warp(block.timestamp + REVEAL_TIMEOUT + 1);

        diceRoll.claimTimeout(betId);

        DiceRoll.Bet memory bet = diceRoll.getBet(betId);
        assertEq(uint8(bet.status), uint8(DiceRoll.BetStatus.Refunded));
        assertEq(token.balanceOf(player) - playerBalBefore, 995e18);
    }

    // ──────────────────────────────────────────────
    // Max bet per choice
    // ──────────────────────────────────────────────

    function test_maxBet_variesByChoice() public view {
        uint256 maxBet50 = diceRoll.getMaxBet(50);
        uint256 maxBet10 = diceRoll.getMaxBet(10);
        uint256 maxBet95 = diceRoll.getMaxBet(95);

        // Lower choice = higher multiplier = lower max bet
        assertGt(maxBet95, maxBet50);
        assertGt(maxBet50, maxBet10);
    }

    // ──────────────────────────────────────────────
    // Fuzz tests
    // ──────────────────────────────────────────────

    function testFuzz_multiplier_alwaysPositive(uint256 choice) public view {
        choice = bound(choice, 2, 100);
        uint256 mult = diceRoll.getMultiplierBps(choice);
        assertGt(mult, 0);
    }

    function testFuzz_placeBet_validChoices(uint256 choice) public {
        choice = bound(choice, 2, 100);
        uint256 maxBetAmount = diceRoll.getMaxBet(choice);
        uint256 betAmount = bound(maxBetAmount, 1, maxBetAmount);

        if (betAmount > 0) {
            token.mint(player, betAmount);
            vm.prank(player);
            token.approve(address(diceRoll), betAmount);

            bytes32 playerSeed = bytes32(choice);
            bytes32 commitHash = keccak256(abi.encodePacked(playerSeed));

            vm.prank(player);
            uint256 betId = diceRoll.placeBet(betAmount, choice, commitHash);

            DiceRoll.Bet memory bet = diceRoll.getBet(betId);
            assertEq(uint8(bet.status), uint8(DiceRoll.BetStatus.Pending));
        }
    }

    function testFuzz_expectedValue_houseEdge(uint256 choice) public view {
        choice = bound(choice, 2, 100);

        // Win probability = (choice - 1) / 100
        // Payout multiplier = 100 * 9800 / (choice * 10000)
        // Expected value = winProb * payout = (choice-1)/100 * 100*9800/(choice*10000)
        //                = (choice-1) * 9800 / (choice * 10000)
        //                = (choice-1) * 98 / (choice * 100)
        // This should always be < 1.0 (house edge), i.e., < 10000 BPS

        uint256 winProbBps = ((choice - 1) * 10_000) / 100;
        uint256 multiplierBps = diceRoll.getMultiplierBps(choice);

        // EV in BPS^2: winProbBps * multiplierBps / 10000
        uint256 evBps = (winProbBps * multiplierBps) / 10_000;

        // EV should be < 10000 (player has negative expected value due to house edge)
        assertLt(evBps, 10_000);
    }

    // ──────────────────────────────────────────────
    // Pausing
    // ──────────────────────────────────────────────

    function test_pause_unpause() public {
        diceRoll.setPaused(true);

        vm.prank(player);
        vm.expectRevert(DiceRoll.GamePaused.selector);
        diceRoll.placeBet(100e18, 50, bytes32(uint256(1)));

        diceRoll.setPaused(false);

        // Should work now
        vm.prank(player);
        diceRoll.placeBet(100e18, 50, bytes32(uint256(1)));
    }

    function test_setPaused_revertNotOwner() public {
        vm.prank(player);
        vm.expectRevert();
        diceRoll.setPaused(true);
    }
}
