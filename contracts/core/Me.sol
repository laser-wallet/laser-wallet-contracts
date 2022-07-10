// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

/**
 * @title Me - Only address(this) can perform certain operations.
 */
contract Me {
    error Me__notMe();

    modifier onlyMe() {
        if (msg.sender != address(this)) revert Me__notMe();

        _;
    }
}
