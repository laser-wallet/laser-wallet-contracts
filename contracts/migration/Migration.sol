// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "../libraries/LaserWalletStorage.sol";

/**
 * @title Migration - migrates a Safe contract from 1.3.0 to 1.2.0
 *  @author Modified from Gnosis Safe.
 */
contract Migration is LaserWalletStorage {


    address public immutable migrationSingleton;
    address public immutable safe120Singleton;

    constructor(address targetSingleton) {
        require(
            targetSingleton != address(0),
            "Invalid singleton address provided"
        );
        safe120Singleton = targetSingleton;
        migrationSingleton = address(this);
    }

    event ChangedMasterCopy(address singleton);

    bytes32 private guard;

    /**
     * @dev Allows to migrate the contract. This can only be called via a delegatecall.
     */
    function migrate() public {
        require(
            address(this) != migrationSingleton,
            "Migration should only be called via delegatecall"
        );
        // Master copy address cannot be null.
        singleton = safe120Singleton;
        emit ChangedMasterCopy(singleton);
    }
}
