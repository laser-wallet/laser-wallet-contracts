// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

/**
 * @title SelfAuthorized - authorizes current contract to perform actions.
 * @author Modified from Gnosis Safe.
 */
contract SelfAuthorized {

    modifier authorized() {
        require(msg.sender == address(this), "Only callable from the wallet");
        _;
    }
}
