// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../interfaces/IERC165.sol";
import "../interfaces/ISingleton.sol";
import "./Me.sol";

/**
 * @title Singleton - Master copy contract.
 */
contract Singleton is ISingleton, Me {
    ///@dev Singleton always needs to be first declared variable, to ensure that it is at the same location as in the Proxy contract.
    /// It should also always be ensured that the address is stored alone (uses a full word).
    address public singleton;

    /**
     * @dev Migrates to a new singleton (implementation).
     * @param _singleton New implementation address.
     */
    function upgradeSingleton(address _singleton) external onlyMe {
        if (_singleton == address(this)) revert Singleton__upgradeSingleton__incorrectAddress();

        if (!IERC165(_singleton).supportsInterface(0xae029e0b)) {
            //bytes4(keccak256("I_AM_LASER")))
            revert Singleton__upgradeSingleton__notLaser();
        } else {
            assembly {
                // We store the singleton at storage slot 0 through inline assembly to save some gas and to be very explicit about slot positions.
                sstore(0, _singleton)
            }
            emit SingletonChanged(_singleton);
        }
    }
}
