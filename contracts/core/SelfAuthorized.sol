// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

/**
 * @title SelfAuthorized - authorizes current contract to perform actions.
 * @author Modified from Gnosis Safe.
 */
contract SelfAuthorized {
    error SelfAuthorized__OnlyCallableFromWallet();
    modifier authorized() {
        if (msg.sender != address(this))
            revert SelfAuthorized__OnlyCallableFromWallet();

        _;
    }
}
