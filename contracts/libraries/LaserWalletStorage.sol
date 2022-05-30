// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.14;

/**
 * @title LaserWalletStorage
 * @dev Contract that maps the storage of the wallet.
 */
contract LaserWalletStorage {
    // core/Singleton.sol
    address public singleton;

    // core/AccountAbstraction.sol
    address public entryPoint;

    // core/Owner.sol
    address public owner;

    // ssr/SSR.sol
    address public recoveryOwner;
    uint256 public guardianCount;
    bool public isLocked;

    // LaserWallet.sol
    uint256 public nonce;
}
