// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.9;

import "../LaserWallet.sol";

contract TestMigrate is LaserWallet {
    function imNew() external pure returns (string memory) {
        return "New";
    }
}
