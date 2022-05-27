// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.14;

interface IERC777TokensRecipient {
    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external;
}
