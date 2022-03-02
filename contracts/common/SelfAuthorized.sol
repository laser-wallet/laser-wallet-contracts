// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

/**
 * @title SelfAuthorized - authorizes current contract to perform actions.
 * @author Modified from Gnosis Safe.
 */
contract SelfAuthorized {
    function requireSelfCall() private view {
        require(msg.sender == address(this), "Only callable from the wallet");
    }

    modifier authorized() {
        // This is a function call as it minimized the bytecode size
        requireSelfCall();
        _;
    }
}
