// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.14;

/**
 * @title IOwner
 * @notice Has all the external functions, events and errors for Owner.sol.
 */
interface IOwner {
    event OwnerChanged(address newOwner);

    ///@dev changeOwner() custom error.
    error Owner__changeOwner__invalidOwnerAddress();

    ///@dev initOwner() custom errors.
    error Owner__initOwner__walletInitialized();
    error Owner__initOwner__invalidOwnerAddress();
    error Owner__initOwner__invalidRecoveryOwnerAddress();

    /**
     * @dev Changes the owner of the wallet.
     * @param newOwner The address of the new owner.
     */
    function changeOwner(address newOwner) external;
}
