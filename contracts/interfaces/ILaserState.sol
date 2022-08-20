// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.16;

interface ILaserState {
    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event OwnerChanged(address newOwner);

    event SingletonChanged(address newSingleton);

    event NewGuardian(address newGuardian);

    event GuardianRemoved(address removedGuardian);

    event NewRecoveryOwner(address NewRecoveryOwner);

    event RecoveryOwnerRemoved(address removedRecoveryOwner);

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error LS__upgradeSingleton__notLaser();

    error LS__initOwner__walletInitialized();

    error LS__initOwner__invalidAddress();

    error LS__addGuardian__invalidAddress();

    error LS__removeGuardian__invalidAddress();

    error LS__removeGuardian__incorrectPreviousGuardian();

    error LS__removeGuardian__underflow();

    error LS__initGuardians__underflow();

    error LS__initGuardians__invalidAddress();

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    function singleton() external view returns (address);

    function owner() external view returns (address);

    function isLocked() external view returns (bool);

    function nonce() external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL
    //////////////////////////////////////////////////////////////*/
}
