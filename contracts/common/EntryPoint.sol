// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;
import "../common/SelfAuthorized.sol";

/**
 * @title EntryPoint - Handles the entry point address. Can only be changed through a safe transaction.
 */
contract EntryPoint is SelfAuthorized {
    event EntryPointChanged(address entryPoint);
    // entrypoint address should always be the second slot of the contract.
    // right after the singleton
    address internal entryPoint;

    /**
     * @dev chananges the entry point address.
     * @param _entryPoint  new entry point address.
     */
    function changeEntryPoint(address _entryPoint) public authorized {
        require(entryPoint != address(0), "Wallet not initialized");
        require(
            _entryPoint != entryPoint &&
                _entryPoint != address(0) &&
                _entryPoint != address(this),
            "Incorrect entry point address"
        );
        entryPoint = _entryPoint;
        emit EntryPointChanged(entryPoint);
    }
}
