// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {HouseVault} from "../src/core/HouseVault.sol";
import {SessionManager} from "../src/core/SessionManager.sol";
import {RandomnessProvider} from "../src/core/RandomnessProvider.sol";
import {FeeCollector} from "../src/periphery/FeeCollector.sol";
import {Leaderboard} from "../src/periphery/Leaderboard.sol";
import {CoinFlip} from "../src/games/CoinFlip.sol";
import {DiceRoll} from "../src/games/DiceRoll.sol";
import {CrashGame} from "../src/games/CrashGame.sol";

/// @title Deploy
/// @notice Deployment script for the InitiaBet casino platform.
///
///  Required environment variables:
///   - TOKEN_ADDRESS: ERC20 token used as bankroll (e.g., INIT on MiniEVM)
///   - HOUSE_OPERATOR: Address that reveals random seeds
///   - TREASURY: Protocol treasury address
///   - PRIVATE_KEY: Deployer private key (used by forge script)
///
///  Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url <RPC_URL> \
///     --broadcast \
///     --verify
contract Deploy is Script {
    // Default configuration
    uint256 constant REVEAL_TIMEOUT = 300; // 5 minutes
    uint256 constant FEE_BPS = 50; // 0.5%
    uint256 constant TREASURY_SHARE_BPS = 5_000; // 50% of fees to treasury
    uint256 constant BETTING_DURATION = 30; // 30 seconds for crash game betting window

    function run() external {
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        address houseOperator = vm.envAddress("HOUSE_OPERATOR");
        address treasury = vm.envAddress("TREASURY");

        vm.startBroadcast();

        IERC20 token = IERC20(tokenAddress);

        // 1. Deploy core infrastructure
        console.log("Deploying HouseVault...");
        HouseVault vault = new HouseVault(token);
        console.log("  HouseVault:", address(vault));

        console.log("Deploying SessionManager...");
        SessionManager sessionManager = new SessionManager();
        console.log("  SessionManager:", address(sessionManager));

        console.log("Deploying RandomnessProvider...");
        RandomnessProvider randomness = new RandomnessProvider(houseOperator, REVEAL_TIMEOUT);
        console.log("  RandomnessProvider:", address(randomness));

        // 2. Deploy periphery
        console.log("Deploying FeeCollector...");
        FeeCollector feeCollector = new FeeCollector(token, treasury, address(vault), FEE_BPS, TREASURY_SHARE_BPS);
        console.log("  FeeCollector:", address(feeCollector));

        console.log("Deploying Leaderboard...");
        Leaderboard leaderboard = new Leaderboard();
        console.log("  Leaderboard:", address(leaderboard));

        // 3. Deploy games
        console.log("Deploying CoinFlip...");
        CoinFlip coinFlip = new CoinFlip(token, vault, randomness, sessionManager, feeCollector, leaderboard);
        console.log("  CoinFlip:", address(coinFlip));

        console.log("Deploying DiceRoll...");
        DiceRoll diceRoll = new DiceRoll(token, vault, randomness, sessionManager, feeCollector, leaderboard);
        console.log("  DiceRoll:", address(diceRoll));

        console.log("Deploying CrashGame...");
        CrashGame crashGame =
            new CrashGame(token, vault, sessionManager, feeCollector, leaderboard, houseOperator, BETTING_DURATION);
        console.log("  CrashGame:", address(crashGame));

        // 4. Configure authorizations
        console.log("Configuring authorizations...");

        // Authorize games in HouseVault
        vault.authorizeGame(address(coinFlip));
        vault.authorizeGame(address(diceRoll));
        vault.authorizeGame(address(crashGame));

        // Authorize games in RandomnessProvider
        randomness.authorizeGame(address(coinFlip));
        randomness.authorizeGame(address(diceRoll));

        // Authorize games in FeeCollector
        feeCollector.authorizeGame(address(coinFlip));
        feeCollector.authorizeGame(address(diceRoll));
        feeCollector.authorizeGame(address(crashGame));

        // Authorize games in Leaderboard
        leaderboard.authorizeGame(address(coinFlip));
        leaderboard.authorizeGame(address(diceRoll));
        leaderboard.authorizeGame(address(crashGame));

        // Register games in SessionManager
        sessionManager.registerGame(address(coinFlip));
        sessionManager.registerGame(address(diceRoll));
        sessionManager.registerGame(address(crashGame));

        vm.stopBroadcast();

        console.log("");
        console.log("=== InitiaBet Deployment Complete ===");
        console.log("Token:              ", tokenAddress);
        console.log("HouseVault:         ", address(vault));
        console.log("SessionManager:     ", address(sessionManager));
        console.log("RandomnessProvider: ", address(randomness));
        console.log("FeeCollector:       ", address(feeCollector));
        console.log("Leaderboard:        ", address(leaderboard));
        console.log("CoinFlip:           ", address(coinFlip));
        console.log("DiceRoll:           ", address(diceRoll));
        console.log("CrashGame:          ", address(crashGame));
    }
}
