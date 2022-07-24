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
}
