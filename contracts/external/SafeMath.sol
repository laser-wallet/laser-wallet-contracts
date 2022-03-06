// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

library SafeMath {
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }
}
