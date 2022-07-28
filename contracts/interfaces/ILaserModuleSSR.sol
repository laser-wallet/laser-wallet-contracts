// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "./IERC165.sol";

interface ILaserModuleSSR {
    error SSR__onlyWallet__notWallet();

    error SSR__initGuardians__underflow();

    error SSR__initRecoveryOwners__underflow();

    error SSR__verifyNewRecoveryOwnerOrGuardian__invalidAddress();

    ///@dev removeGuardian() custom errors.
    error SSR__removeGuardian__underflow();
    error SSR__removeGuardian__invalidAddress();
    error SSR__removeGuardian__incorrectPreviousGuardian();

    ///@dev removeRecoveryOwner() custom errors.
    error SSR__removeRecoveryOwner__underflow();
    error SSR__removeRecoveryOwner__invalidAddress();
    error SSR__removeRecoveryOwner__incorrectPreviousRecoveryOwner();

    ///@dev swapGuardian() custom errors.
    error SSR__swapGuardian__invalidPrevGuardian();
    error SSR__swapGuardian__invalidOldGuardian();

    ///@dev swapRecoveryOwner() custom errors.
    error SSR__swapRecoveryOwner__invalidPrevRecoveryOwner();
    error SSR__swapRecoveryOwner__invalidOldRecoveryOwner();

    ///@dev Inits the module.
    ///@notice The target wallet is the 'msg.sender'.
    function initSSR(address[] calldata _guardians, address[] calldata _recoveryOwners) external;

    ///@dev Locks the target wallet.
    ///@param wallet The target wallet address.
    ///@param callData Data payload.
    ///@param maxFeePerGas Maximum WEI per uinit of gas.
    ///@param gasLimit Maximum units of gas to spend for this transaction.
    ///@param relayer Address to refund for the transaction inclusion.
    ///@notice Can only be called by a recovery owner + guardian.
    function lock(
        address wallet,
        bytes calldata callData,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        bytes memory signatures
    ) external;

    ///@dev Returns the chain id of this.
    function getChainId() external view returns (uint256 chainId);
}
