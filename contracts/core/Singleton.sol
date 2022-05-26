// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "./SelfAuthorized.sol";
import "../interfaces/IERC165.sol";

/**
 * @title Singleton - Base for singleton contracts (should always be first super contract).
 * This contract is tightly coupled to our proxy contract (see `proxies/LaserProxy.sol`).
 */
contract Singleton is SelfAuthorized {
    // Singleton always needs to be first declared variable, to ensure that it is at the same location as in the Proxy contract.
    // It should also always be ensured that the address is stored alone (uses a full word)
    address public singleton;

    error Singleton__IncorrectSingletonAddress();
    error Singleton__DoesNotSupportInterface();

    event SingletonChanged(address _singleton);

    /**
     * @dev Migrates to a new singleton (implementation).
     * @param _singleton New implementation address.
     */
    function upgradeSingleton(address _singleton) public authorized {
        if (_singleton == address(this))
            revert Singleton__IncorrectSingletonAddress();

        if (!IERC165(_singleton).supportsInterface(0xae029e0b))
            //bytes4(keccak256("I_AM_LASER")))
            revert Singleton__DoesNotSupportInterface();

        assembly {
            // So we are more explicit.
            // Singleton should always bet at storage slot 0.
            sstore(0, _singleton)
        }
        emit SingletonChanged(_singleton);
    }
}
