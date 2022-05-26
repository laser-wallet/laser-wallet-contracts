// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "./SelfAuthorized.sol";

contract Owner is SelfAuthorized {
    address public owner;

    event OwnerChanged(address newOwner);

    error Owner__InvalidOwnerAddress();
    error Owner__WalletInitialized();

    /**
     * @dev Changes the owner of the wallet.
     * @param newOwner The address of the new owner.
     */
    function changeOwner(address newOwner) public authorized {
        if (
            newOwner == owner ||
            newOwner.code.length != 0 ||
            newOwner == address(0)
        ) revert Owner__InvalidOwnerAddress();
        owner = newOwner;
        emit OwnerChanged(newOwner);
    }

    function initOwner(address newOwner) internal {
        if (owner != address(0)) revert Owner__WalletInitialized();
        if (
            newOwner == owner ||
            newOwner.code.length != 0 ||
            newOwner == address(0)
        ) revert Owner__InvalidOwnerAddress();
        owner = newOwner;
    }
}
