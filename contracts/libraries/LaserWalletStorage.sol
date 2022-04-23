// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

/// @title LaserStorage - Storage layout of the Safe contracts to be used in libraries.
contract LaserWalletStorage {
    // From /common/Singleton.sol
    address public singleton;

    // From /common/EntryPoint.sol
    address public entryPoint;

    //From /base/OwnerManager.sol
    mapping(address => address) internal owners;
    mapping(address => bool) internal specialOwners;
    uint256 internal ownerCount;
    uint256 internal specialOwnerCount;
    uint256 internal threshold;

    // From /modules/Guard.sol
    uint256 ethSpendingLimit;

    // From /LaserWallet.sol
    uint256 public nonce;
}
