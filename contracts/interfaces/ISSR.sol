// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

/**
 * @title ISSR
 * @notice Has all the external functions, structs, events and errors for SSR.sol.
 */
interface ISSR {
    ///@dev Determines who has access to call a specific function.
    enum Access {
        Owner,
        Guardian,
        OwnerAndGuardian,
        RecoveryOwnerAndGuardian,
        OwnerAndRecoveryOwner
    }

    event WalletLocked();
    event WalletUnlocked();
    event RecoveryUnlocked();
    event OwnerChanged(address newOwner);
    event NewGuardian(address newGuardian);
    event GuardianRemoved(address removedGuardian);
    event GuardianSwapped(address newGuardian, address oldGuardian);
    event NewRecoveryOwner(address newRecoveryOwner);
    event RecoveryOwnerRemoved(address removedRecoveryOwner);
    event RecoveryOwnerSwapped(address newRecoveryOwner, address oldRecoveryOwner);
    event WalletRecovered(address newOwner);

    ///@dev changeOwner() custom error.
    error SSR__changeOwner__invalidAddress();

    ///@dev addGuardian() custom error.
    error SSR__addGuardian__invalidAddress();

    ///@dev removeGuardian() custom errors.
    error SSR__removeGuardian__underflow();
    error SSR__removeGuardian__invalidAddress();
    error SSR__removeGuardian__incorrectPreviousGuardian();

    ///@dev swapRecoveryOwner() custom errors.
    error SSR__swapGuardian__invalidPrevGuardian();
    error SSR__swapGuardian__invalidOldGuardian();

    ///@dev addRecoveryOwner() custom error.
    error SSR__addRecoveryOwner__invalidAddress();

    ///@dev removeRecoveryOwner() custom errors.
    error SSR__removeRecoveryOwner__underflow();
    error SSR__removeRecoveryOwner__invalidAddress();
    error SSR__removeRecoveryOwner__incorrectPreviousRecoveryOwner();

    ///@dev swapRecoveryOwner() custom errors.
    error SSR__swapRecoveryOwner__invalidPrevRecoveryOwner();
    error SSR__swapRecoveryOwner__invalidOldRecoveryOwner();

    ///@dev initOwner() custom errors.
    error SSR__initOwner__walletInitialized();
    error SSR__initOwner__invalidAddress();

    ///@dev initGuardians() custom errors.
    error SSR__initGuardians__underflow();
    error SSR__initGuardians__invalidAddress();

    ///@dev initRecoveryOwners() custom error.
    error SSR__initRecoveryOwners__underflow();
    error SSR__initRecoveryOwners__invalidAddress();

    ///@dev access() custom errors.
    error SSR__access__walletLocked();

    ///@dev validateRecoveryOwner() custom error.
    error SSR__validateRecoveryOwner__notAuthorized();

    ///@dev verifyNewRecoveryOwnerOrGuardian() custom error.
    error SSR__verifyNewRecoveryOwnerOrGuardian__invalidAddress();

    ///@dev timeLockVerifier() custom error.
    error SSR__timeLockVerifier__lessThanOneWeek();
    error SSR__timeLockVerifier__notActivated();

    /**
     * @dev Locks the wallet. Can only be called by a guardian.
     */
    function lock() external;

    /**
     * @dev Unlocks the wallet. Can only be called by a guardian + the owner.
     */
    function unlock() external;

    function recoveryUnlock(
        address[] calldata prevGuardians,
        address[] calldata guardiansToRemove,
        address[] calldata newGuardians
    ) external;

    /**
     * @dev Can only recover with the signature of a recovery owner and guardian.
     * @param newOwner The new owner address. This is generated instantaneously.
     */
    function recover(address newOwner) external;

    /**
     * @dev Adds a guardian to the wallet.
     * @param newGuardian Address of the new guardian.
     * @notice Can only be called by the owner.
     */
    function addGuardian(address newGuardian) external;

    /**
     * @dev Removes a guardian to the wallet.
     * @param prevGuardian Address of the previous guardian in the linked list.
     * @param guardianToRemove Address of the guardian to be removed.
     * @notice Can only be called by the owner.
     */
    function removeGuardian(address prevGuardian, address guardianToRemove) external;

    /**
     * @dev Swaps a guardian for a new address.
     * @param prevGuardian The address of the previous guardian in the link list.
     * @param newGuardian The address of the new guardian.
     * @param oldGuardian The address of the current guardian to be swapped by the new one.
     */
    function swapGuardian(
        address prevGuardian,
        address newGuardian,
        address oldGuardian
    ) external;

    /**
     * @dev Adds a recovery owner to the wallet.
     * @param newRecoveryOwner Address of the new recovery owner.
     * @notice Can only be called by the owner.
     */
    function addRecoveryOwner(address newRecoveryOwner) external;

    /**
     * @dev Removes a recovery owner  to the wallet.
     * @param prevRecoveryOwner Address of the previous recovery owner in the linked list.
     * @param recoveryOwnerToRemove Address of the recovery owner to be removed.
     * @notice Can only be called by the owner.
     */
    function removeRecoveryOwner(address prevRecoveryOwner, address recoveryOwnerToRemove) external;

    /**
     * @dev Swaps a recovery owner for a new address.
     * @param prevRecoveryOwner The address of the previous owner in the link list.
     * @param newRecoveryOwner The address of the new recovery owner.
     * @param oldRecoveryOwner The address of the current recovery owner to be swapped by the new one.
     */
    function swapRecoveryOwner(
        address prevRecoveryOwner,
        address newRecoveryOwner,
        address oldRecoveryOwner
    ) external;

    /**
     * @return Array of the guardians of this wallet.
     */
    function getGuardians() external view returns (address[] memory);

    /**
     * @return Array of the recovery owners of this wallet.
     */
    function getRecoveryOwners() external view returns (address[] memory);
}
