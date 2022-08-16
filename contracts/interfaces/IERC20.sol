// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.16;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);

    function allowance(address, address) external view returns (uint256);
}
