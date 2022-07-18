// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../core/Me.sol";

/**
 * @title Vault - Double step to transfer assets outside of the vault.
 */
contract Vault is Me {
    mapping(address => uint256) public tokensInVault;

    mapping(address => uint256) public nftsInVault;

    function addTokenToVault(address token, uint256 amount) external onlyMe {
        tokensInVault[token] = amount;
    }

    function addNftToVault(address nft, uint256 index) external onlyMe {
        nftsInVault[nft] = index;
    }
}
