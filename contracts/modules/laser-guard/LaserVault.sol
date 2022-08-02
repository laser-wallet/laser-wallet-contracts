// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

/**
 * @title  LaserVault
 *
 * @author Rodrigo Herrera I.
 *
 * @notice Laser guard module that locks the assets of a Laser wallet for extra security.
 *         It acts as a vault in the sense that the locked assets cannot be use unless the wallet's
 *         owner (or authorized module) orders otherwise.
 */
contract LaserVault {
    mapping(address => mapping(address => uint256)) internal tokensInVault;

    function verifyTransaction(
        address wallet,
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        bytes calldata signature
    ) external pure {
        // Quite compiler warnings for now.
        (wallet, to, value, callData, nonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit, signature);
    }

    function addTokensToVault(address token, uint256 amount) external {
        address wallet = msg.sender;

        tokensInVault[wallet][token] += amount;
    }

    function removeTokensFromVault(address token, uint256 amount) external {
        address wallet = msg.sender;

        //@todo Check that the wallet has enough tokens.
        tokensInVault[wallet][token] -= amount;
    }
}
