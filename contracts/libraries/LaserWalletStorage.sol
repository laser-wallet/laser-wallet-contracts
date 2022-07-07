// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

/**
 * @title LaserWalletStorage
 * @dev Contract that maps the storage of the wallet.
 */
contract LaserWalletStorage {
    // core/Singleton.sol
    address public singleton;

    // core/Owner.sol
    address public owner;
    address public recoveryOwner;

    // ssr/SSR.sol
    uint256 internal guardianCount;
    bool public isLocked;
    bool public guardiansBlocked;
    mapping(address => address) internal guardians;

    // LaserWallet.sol
    uint256 public nonce;
}
