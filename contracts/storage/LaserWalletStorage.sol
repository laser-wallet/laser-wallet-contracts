// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

/**
 * @title LaserWalletStorage
 *
 * @notice Contract that maps the storage of Laser wallet.
 */
abstract contract LaserWalletStorage {
    // LaserState.sol
    address public singleton;

    address public owner;

    address public laserMasterGuard;

    address public laserRegistry;

    bool public isLocked;

    uint256 public nonce;

    mapping(address => address) internal laserModules;
}
