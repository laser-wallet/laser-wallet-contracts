// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.14;

import "../core/SelfAuthorized.sol";
import "../interfaces/IStakeManager.sol";

/**
 * @title AccountAbstraction - Handles the entry point address. Can only be changed through a safe transaction.
 */
contract AccountAbstraction is SelfAuthorized {
    event EntryPointChanged(address entryPoint);
    // Entrypoint address should always be located at storage slot 1.
    address public entryPoint;

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    error AA__InvalidEntryPoint();
    error AA__InsufficientWithdrawBalance();
    error AA_NotEntryPoint();

    modifier onlyFromEntryPoint() {
        if (msg.sender != entryPoint) {
            revert AA_NotEntryPoint();
        }
        _;
    }

    function initEntryPoint(address _entryPoint) internal {
        if (_entryPoint.code.length == 0 || _entryPoint == address(this))
            revert AA__InvalidEntryPoint();

        assembly {
            // entryPoint address should always be at storage slot 1.
            sstore(1, _entryPoint)
        }
    }

    /**
     * @dev Withdraws deposits from the Entry Point.
     */
    function withdrawDeposit(uint256 amount) public authorized {
        if (IStakeManager(entryPoint).balanceOf(address(this)) < amount)
            revert AA__InsufficientWithdrawBalance();

        // The stake manager will check for success.
        IStakeManager(entryPoint).withdrawTo(address(this), amount);
    }

    /**
     * @dev Changes the entry point address.
     * @param _entryPoint  new entry point address.
     * @notice The entry point address can execute a transaction without signature requirement
     * If it is a malicious address. There needs to be extra caution in changing the entry point.
     */
    function changeEntryPoint(address _entryPoint) public authorized {
        if (_entryPoint.code.length == 0 || _entryPoint == address(this))
            revert AA__InvalidEntryPoint();

        assembly {
            // entryPoint address should always be at storage slot 1.
            sstore(1, _entryPoint)
        }
        emit EntryPointChanged(entryPoint);
    }
}
