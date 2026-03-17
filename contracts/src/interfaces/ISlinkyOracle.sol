// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISlinkyOracle
/// @notice Interface for Initia's enshrined Slinky oracle precompile at 0x0B
/// @dev On MiniEVM, Slinky oracle is available as a precompile contract.
///      Prices are push-based and updated every block by validators.
interface ISlinkyOracle {
    /// @notice Get the price for a given currency pair
    /// @param pair The currency pair string, e.g. "BTC/USD", "ETH/USD", "INIT/USD"
    /// @return price The price scaled to 8 decimal places
    /// @return timestamp The block timestamp when this price was last updated
    function get_price(string calldata pair) external view returns (uint256 price, uint256 timestamp);

    /// @notice Get all available currency pairs
    /// @return An array of currency pair strings
    function get_all_currency_pairs() external view returns (string[] memory);
}
