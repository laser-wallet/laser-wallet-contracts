// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.14;

import "../interfaces/IOwner.sol";
import "./SelfAuthorized.sol";

/**
 * @title Owner
 * @notice Handles the owner address.
 */
contract Owner is IOwner, SelfAuthorized {
    ///@dev owner should always bet at storage slot 2.
    address public owner;

    /**
     * @dev Changes the owner of the wallet.
     * @param newOwner The address of the new owner.
     */
    function changeOwner(address newOwner) external authorized {
        if (
            newOwner == owner ||
            newOwner.code.length != 0 ||
            newOwner == address(0)
        ) revert Owner__changeOwner__invalidOwnerAddress();
        owner = newOwner;
        emit OwnerChanged(newOwner);
    }

    /**
     * @dev Inits the owner. This can only be called at creation.
     */
    function initOwner(address newOwner) internal {
        // If owner is not address0, the wallet was already initialized...
        if (owner != address(0)) revert Owner__initOwner__walletInitialized();
        if (newOwner.code.length != 0 || newOwner == address(0)) {
            revert Owner__initOwner__invalidOwnerAddress();
        }
        owner = newOwner;
    }
}
