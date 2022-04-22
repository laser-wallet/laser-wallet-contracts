// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

/// @title LaserStorage - Storage layout of the Safe contracts to be used in libraries.
contract LaserWalletStorage {
    // From /common/Singleton.sol
    address internal singleton;
    // From /common/EntryPoint.sol
    address internal entryPoint;
    // From /base/OwnerManager.sol
    mapping(address => address) internal owners;
    mapping(address => bool) internal specialOwner;
    uint256 internal ownerCount;
    uint256 internal specialOwnerCount;
    uint256 internal threshold;

    // From /LaserWallet.sol
    uint256 public nonce;
    mapping(address => mapping(bytes32 => uint256)) internal approvedHashes;
}
