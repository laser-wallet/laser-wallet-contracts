// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../interfaces/IOwner.sol";
import "./Me.sol";

/**
 * @title Owner
 * @notice Handles the owners addresses.
 */
contract Owner is IOwner, Me {
    ///@dev owner should always bet at storage slot 1.
    address public owner;

    /**
     * @dev Changes the owner of the wallet.
     * @param newOwner The address of the new owner.
     */
    function changeOwner(address newOwner) external onlyMe {
        if (newOwner.code.length != 0 || newOwner == address(0) || newOwner == owner) {
            revert Owner__changeOwner__invalidOwnerAddress();
        }
        assembly {
            // We store the owner at storage slot 1 through inline assembly to save some gas and to be very explicit about slot positions.
            sstore(1, newOwner)
        }
        emit OwnerChanged(newOwner);
    }

    /**
     * @dev Inits the owner. This can only be called at creation.
     * @param _owner The owner of the wallet.
     */
    function initOwner(address _owner) internal {
        // If owner is not address 0, the wallet was already initialized ...
        if (owner != address(0)) revert Owner__initOwner__walletInitialized();

        if (_owner.code.length != 0 || _owner == address(0)) revert Owner__initOwner__invalidOwnerAddress();

        assembly {
            // We store the owner at storage slot 1 through inline assembly to save some gas and to be very explicit about slot positions.
            sstore(1, _owner)
        }
    }
}
