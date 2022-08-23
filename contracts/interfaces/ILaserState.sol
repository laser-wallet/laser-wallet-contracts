// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.16;

struct WalletConfig {
    bool isLocked;
    uint256 timestamp;
}

interface ILaserState {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event WalletLocked();

    event WalletUnlocked();

    event WalletRecovered(address newOwner);

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

    function nonce() external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                                EXTERNAL
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Locks the wallet. Can only be called by a recovery owner + recovery owner
     *         or recovery owner + guardian.
     *
     * @dev    Restricted, can only be called by address(this).
     */
    function lock() external;

    /**
     * @notice Unlocks the wallet. Can only be called by the owner + recovery owner
     *         or owner + guardian.
     *
     * @dev    Restricted, can only be called by address(this).
     */
    function unlock() external;

    /**
     * @notice Recovers the wallet. Can only be called by the recovery owner + recovery owner
     *         or recovery owner + guardian.
     *
     * @dev   Restricted, can only be called by address(this).
     *
     * @param newOwner  Address of the new owner.
     */
    function recover(address newOwner) external;

    /**
     * @notice Changes the owner of the wallet. Can only be called by the owner + recovery owner
     *         or owner + guardian.
     *
     * @dev   Restricted, can only be called by address(this).
     *
     * @param newOwner  Address of the new owner.
     */
    function changeOwner(address newOwner) external;
}
