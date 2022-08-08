// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

/**
 * @title  ILaserVault
 *
 * @author Rodrigo Herrera I.
 *
 * @notice Laser guard module that locks assets of a Laser wallet for extra security.
 *         It acts as a vault in the sense that the locked assets cannot be use unless the wallet's
 *         owner (or authorized module) orders otherwise.
 *
 * @dev    This interface has all events, errors, and external function for LaserMasterGuard.
 */
interface ILaserVault {
    // addGuardModule() custom errors.

    /**
     * @notice Verifies that the transaction doesn't spend assets from the vault.
     *
     * @param  wallet   The address of the wallet.
     * @param  to       Destination address.
     * @param  value    Amount in WEI to transfer.
     * @param callData  Data payload for the transaction.
     */
    function verifyTransaction(
        address wallet,
        address to,
        uint256 value,
        bytes calldata callData,
        uint256,
        uint256,
        uint256,
        uint256,
        bytes calldata
    ) external view;

    /**
     * @notice Adds tokens to vault.
     *
     * @param  token  The address of the token.
     * @param  amount Amount of tokens to add to the vault.
     */
    function addTokensToVault(address token, uint256 amount) external;

    /**
     * @notice Removes tokens from vault.
     *
     * @param  token             The address of the token.
     * @param  amount            Amount of tokens to remove to the vault.
     * @param guardianSignature  Signature of one of the wallet's guardians.
     *                           In order to take tokens out of the vault, it needs to be
     *                           signed by the owner + a guardian.
     */
    function removeTokensFromVault(
        address token,
        uint256 amount,
        bytes calldata guardianSignature
    ) external;

    /**
     * @param wallet The address of the wallet. 
     * @param token  The address of the token. 
     *
     * @return The amount of tokens that are in the vault from the provided token and wallet. 
     */
    function getTokensInVault(address wallet, address token) external view returns (uint256);
}
