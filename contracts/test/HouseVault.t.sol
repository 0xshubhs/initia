// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {HouseVault} from "../src/core/HouseVault.sol";

/// @dev Mock ERC20 for testing
contract MockToken is ERC20 {
    uint8 private _dec;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _dec = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract HouseVaultTest is Test {
    MockToken public token;
    HouseVault public vault;

    address public owner = address(this);
    address public lp1 = makeAddr("lp1");
    address public lp2 = makeAddr("lp2");
    address public game1 = makeAddr("game1");
    address public game2 = makeAddr("game2");
    address public player = makeAddr("player");

    function setUp() public {
        token = new MockToken("Test Token", "TEST", 18);
        vault = new HouseVault(IERC20(address(token)));

        // Fund LPs
        token.mint(lp1, 1_000_000e18);
        token.mint(lp2, 500_000e18);
        token.mint(player, 100_000e18);

        // LP approvals
        vm.prank(lp1);
        token.approve(address(vault), type(uint256).max);
        vm.prank(lp2);
        token.approve(address(vault), type(uint256).max);
    }

    // ──────────────────────────────────────────────
    // Authorization tests
    // ──────────────────────────────────────────────

    function test_authorizeGame() public {
        vault.authorizeGame(game1);
        assertTrue(vault.authorizedGames(game1));
        assertEq(vault.gameCount(), 1);
    }

    function test_authorizeGame_emitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit HouseVault.GameAuthorized(game1);
        vault.authorizeGame(game1);
    }

    function test_authorizeGame_revertZeroAddress() public {
        vm.expectRevert(HouseVault.ZeroAddress.selector);
        vault.authorizeGame(address(0));
    }

    function test_authorizeGame_revertAlreadyAuthorized() public {
        vault.authorizeGame(game1);
        vm.expectRevert(HouseVault.GameAlreadyAuthorized.selector);
        vault.authorizeGame(game1);
    }

    function test_authorizeGame_revertNotOwner() public {
        vm.prank(lp1);
        vm.expectRevert();
        vault.authorizeGame(game1);
    }

    function test_revokeGame() public {
        vault.authorizeGame(game1);
        vault.authorizeGame(game2);
        vault.revokeGame(game1);

        assertFalse(vault.authorizedGames(game1));
        assertTrue(vault.authorizedGames(game2));
        assertEq(vault.gameCount(), 1);
    }

    function test_revokeGame_revertNotAuthorized() public {
        vm.expectRevert(HouseVault.GameNotAuthorized.selector);
        vault.revokeGame(game1);
    }

    // ──────────────────────────────────────────────
    // Deposit / Withdrawal tests
    // ──────────────────────────────────────────────

    function test_deposit() public {
        vm.prank(lp1);
        uint256 shares = vault.deposit(100_000e18, lp1);

        assertGt(shares, 0);
        assertEq(vault.totalAssets(), 100_000e18);
        assertEq(vault.balanceOf(lp1), shares);
    }

    function test_multipleDeposits_shareAccounting() public {
        vm.prank(lp1);
        vault.deposit(100_000e18, lp1);

        vm.prank(lp2);
        vault.deposit(50_000e18, lp2);

        assertEq(vault.totalAssets(), 150_000e18);

        // LP1 should have 2x the shares of LP2
        uint256 lp1Shares = vault.balanceOf(lp1);
        uint256 lp2Shares = vault.balanceOf(lp2);
        assertEq(lp1Shares, lp2Shares * 2);
    }

    function test_withdraw() public {
        vm.prank(lp1);
        vault.deposit(100_000e18, lp1);

        uint256 balBefore = token.balanceOf(lp1);

        vm.prank(lp1);
        vault.withdraw(50_000e18, lp1, lp1);

        assertEq(token.balanceOf(lp1) - balBefore, 50_000e18);
        assertEq(vault.totalAssets(), 50_000e18);
    }

    // ──────────────────────────────────────────────
    // Max bet tests
    // ──────────────────────────────────────────────

    function test_maxBet() public {
        vm.prank(lp1);
        vault.deposit(1_000_000e18, lp1);

        // Max bet = bankroll / 50 = 20,000
        assertEq(vault.maxBet(), 20_000e18);
    }

    function test_maxBet_zero_whenEmpty() public {
        assertEq(vault.maxBet(), 0);
    }

    function test_maxBetForMultiplier() public {
        vm.prank(lp1);
        vault.deposit(1_000_000e18, lp1);

        // For 2x multiplier (20000 bps):
        // maxBet = bankroll * 10000 / (50 * 20000) = 1_000_000 * 10000 / 1_000_000 = 10_000
        uint256 max2x = vault.maxBetForMultiplier(20_000);
        assertEq(max2x, 10_000e18);

        // For 10x multiplier (100000 bps):
        // maxBet = 1_000_000 * 10000 / (50 * 100000) = 2_000
        uint256 max10x = vault.maxBetForMultiplier(100_000);
        assertEq(max10x, 2_000e18);
    }

    function test_validateBet_pass() public {
        vm.prank(lp1);
        vault.deposit(1_000_000e18, lp1);

        vault.validateBet(20_000e18); // Exactly max bet - should pass
    }

    function test_validateBet_revert() public {
        vm.prank(lp1);
        vault.deposit(1_000_000e18, lp1);

        vm.expectRevert(
            abi.encodeWithSelector(HouseVault.BetExceedsMaxBet.selector, 20_001e18, 20_000e18)
        );
        vault.validateBet(20_001e18);
    }

    // ──────────────────────────────────────────────
    // Bet / Payout tests
    // ──────────────────────────────────────────────

    function test_recordBet() public {
        vault.authorizeGame(game1);

        vm.prank(lp1);
        vault.deposit(100_000e18, lp1);

        vm.prank(game1);
        vault.recordBet(player, 1_000e18);

        assertEq(vault.totalBetsReceived(), 1_000e18);
    }

    function test_recordBet_revertNotAuthorized() public {
        vm.prank(game1);
        vm.expectRevert(HouseVault.NotAuthorizedGame.selector);
        vault.recordBet(player, 1_000e18);
    }

    function test_recordBet_revertZeroAmount() public {
        vault.authorizeGame(game1);
        vm.prank(game1);
        vm.expectRevert(HouseVault.ZeroAmount.selector);
        vault.recordBet(player, 0);
    }

    function test_sendPayout() public {
        vault.authorizeGame(game1);

        vm.prank(lp1);
        vault.deposit(100_000e18, lp1);

        uint256 playerBalBefore = token.balanceOf(player);

        vm.prank(game1);
        vault.sendPayout(player, 5_000e18);

        assertEq(token.balanceOf(player) - playerBalBefore, 5_000e18);
        assertEq(vault.totalPayouts(), 5_000e18);
        assertEq(vault.totalAssets(), 95_000e18);
    }

    function test_sendPayout_revertInsufficientBankroll() public {
        vault.authorizeGame(game1);

        vm.prank(lp1);
        vault.deposit(100e18, lp1);

        vm.prank(game1);
        vm.expectRevert(
            abi.encodeWithSelector(HouseVault.InsufficientBankroll.selector, 200e18, 100e18)
        );
        vault.sendPayout(player, 200e18);
    }

    function test_sendPayout_revertZeroAddress() public {
        vault.authorizeGame(game1);

        vm.prank(lp1);
        vault.deposit(100_000e18, lp1);

        vm.prank(game1);
        vm.expectRevert(HouseVault.ZeroAddress.selector);
        vault.sendPayout(address(0), 100e18);
    }

    // ──────────────────────────────────────────────
    // Profit/loss tracking
    // ──────────────────────────────────────────────

    function test_epochPnL_profit() public {
        vault.authorizeGame(game1);

        vm.prank(lp1);
        vault.deposit(100_000e18, lp1);

        // Game receives bet
        vm.prank(game1);
        vault.recordBet(player, 1_000e18);

        // PnL should be +1000
        assertEq(vault.getEpochPnL(0), int256(1_000e18));
    }

    function test_epochPnL_loss() public {
        vault.authorizeGame(game1);

        vm.prank(lp1);
        vault.deposit(100_000e18, lp1);

        // Game receives bet then pays out more
        vm.prank(game1);
        vault.recordBet(player, 1_000e18);

        vm.prank(game1);
        vault.sendPayout(player, 1_960e18);

        // PnL should be 1000 - 1960 = -960
        assertEq(vault.getEpochPnL(0), int256(1_000e18) - int256(1_960e18));
    }

    function test_epochAdvance() public {
        vault.authorizeGame(game1);

        vm.prank(lp1);
        vault.deposit(100_000e18, lp1);

        vm.prank(game1);
        vault.recordBet(player, 1_000e18);

        assertEq(vault.currentEpoch(), 0);

        // Advance time past epoch duration
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(game1);
        vault.recordBet(player, 500e18);

        assertEq(vault.currentEpoch(), 1);
    }

    // ──────────────────────────────────────────────
    // Share value after profit/loss
    // ──────────────────────────────────────────────

    function test_shareValue_increases_on_profit() public {
        vault.authorizeGame(game1);

        vm.prank(lp1);
        vault.deposit(100_000e18, lp1);

        uint256 sharesBefore = vault.balanceOf(lp1);

        // Simulate profit: transfer tokens directly to vault (like house winning)
        token.mint(address(vault), 10_000e18);

        // LP should be able to redeem more tokens now (allow small ERC4626 rounding)
        uint256 redeemable = vault.previewRedeem(sharesBefore);
        assertApproxEqAbs(redeemable, 110_000e18, 1e18);
    }

    function test_shareValue_decreases_on_loss() public {
        vault.authorizeGame(game1);

        vm.prank(lp1);
        vault.deposit(100_000e18, lp1);

        uint256 sharesBefore = vault.balanceOf(lp1);

        // Simulate loss: vault pays out
        vm.prank(game1);
        vault.sendPayout(player, 10_000e18);

        uint256 redeemable = vault.previewRedeem(sharesBefore);
        assertEq(redeemable, 90_000e18);
    }

    // ──────────────────────────────────────────────
    // Fuzz tests
    // ──────────────────────────────────────────────

    function testFuzz_deposit_withdraw_accounting(uint256 depositAmount) public {
        depositAmount = bound(depositAmount, 1, 1_000_000e18);

        vm.prank(lp1);
        uint256 shares = vault.deposit(depositAmount, lp1);

        assertGt(shares, 0);

        vm.prank(lp1);
        uint256 withdrawn = vault.redeem(shares, lp1, lp1);

        // Should get back the same amount (minus any rounding)
        assertApproxEqAbs(withdrawn, depositAmount, 1);
    }

    function testFuzz_maxBet_always_two_percent(uint256 depositAmount) public {
        // Bound to LP1's balance
        depositAmount = bound(depositAmount, 100, 1_000_000e18);

        vm.prank(lp1);
        vault.deposit(depositAmount, lp1);

        uint256 maxBetVal = vault.maxBet();
        assertEq(maxBetVal, depositAmount / 50);
    }

    // ──────────────────────────────────────────────
    // Different decimal tokens
    // ──────────────────────────────────────────────

    function test_works_with_6_decimals() public {
        MockToken usdc = new MockToken("USDC", "USDC", 6);
        HouseVault vault6 = new HouseVault(IERC20(address(usdc)));

        usdc.mint(lp1, 1_000_000e6);

        vm.startPrank(lp1);
        usdc.approve(address(vault6), type(uint256).max);
        vault6.deposit(1_000_000e6, lp1);
        vm.stopPrank();

        assertEq(vault6.maxBet(), 20_000e6);
    }
}
