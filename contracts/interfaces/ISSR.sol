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
    event NewGuardian(address newGuardian);
    event GuardianRemoved(address removedGuardian);
    event GuardianSwapped(address newGuardian, address oldGuardian);
    event NewRecoveryOwner(address newRecoveryOwner);
    event RecoveryOwnerRemoved(address removedRecoveryOwner);
    event RecoveryOwnerSwapped(address newRecoveryOwner, address oldRecoveryOwner);
    event WalletRecovered(address newOwner);

    ///@dev addGuardian() custom errors.
    error SSR__addGuardian__invalidAddress();

    ///@dev removeGuardian() custom errors.
    error SSR__removeGuardian__invalidAddress();
    error SSR__removeGuardian__incorrectPreviousGuardian();
    error SSR__removeGuardian__underflow();

    ///@dev swapRecoveryOwner() custom errors.
    error SSR__swapGuardian__invalidPrevGuardian();
    error SSR__swapGuardian__invalidOldGuardian();

    ///@dev addRecoveryOwner() custom error.
    error SSR__addRecoveryOwner__invalidAddress();

    ///@dev removeRecoveryOwner() custom error.
    error SSR__removeRecoveryOwner__incorrectIndex();

    ///@dev swapRecoveryOwner() custom errors.
    error SSR__swapRecoveryOwner__invalidPrevRecoveryOwner();
    error SSR__swapRecoveryOwner__invalidOldRecoveryOwner();

    ///@dev initRecoveryOwners() custom error.
    error SSR__initRecoveryOwners__underflow();
    error SSR__initRecoveryOwners__invalidAddress();

    ///@dev initGuardians() custom errors.
    error SSR__initGuardians__underflow();
    error SSR__initGuardians__invalidAddress();

    ///@dev access() custom errors.
    error SSR__access__guardiansLocked();
    error SSR__access__walletLocked();

    ///@dev validateRecoveryOwner() custom error.
    error SSR__validateRecoveryOwner__notAuthorized();

    ///@dev verifyNewRecoveryOwnerOrGuardian() custom error.
    error SSR__verifyNewRecoveryOwnerOrGuardian__invalidAddress();

    /**
     * @dev Locks the wallet. Can only be called by a guardian.
     */
    function lock() external;

    /**
     * @dev Unlocks the wallet. Can only be called by a guardian + the owner.
     */
    function unlock() external;

    /**
     * @dev Unlocks the wallet. Can only be called by the recovery owner + the owner.
     * This is to avoid the wallet being locked forever if a guardian misbehaves.
     * The guardians will be locked until the owner decides otherwise.
     */
    function recoveryUnlock() external;

    /**
     * @dev Unlocks the guardians. This can only be called by the owner.
     */
    function unlockGuardians() external;

    /**
     * @dev Can only recover with the signature of the recovery owner and guardian.
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
     * @dev Adds a new recovery owner to the chain list.
     * @param newRecoveryOwner The address of the new recovery owner.
     * @notice The new recovery owner will be added at the end of the chain.
     */
    function addRecoveryOwner(address newRecoveryOwner) external;

    /**
     * @dev Removes a guardian to the wallet.
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
     * @param guardian Requested address.
     * @return Boolean if the address is a guardian of the current wallet.
     */
    function isGuardian(address guardian) external view returns (bool);

    /**
     * @return Array of the recovery owners in struct format 'RecoverySettings'.
     */
    function getRecoveryOwners() external view returns (address[] memory);

    /**
     * @return Array of guardians of this.
     */
    function getGuardians() external view returns (address[] memory);
}
