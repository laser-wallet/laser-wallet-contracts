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
    event WalletRecovered(address newOwner, address newRecoveryOwner);
    event NewRecoveryOwner(address recoveryOwner);

    ///@dev modifier custom errors.
    error SSR__walletLocked();

    ///@dev modifier custom errors.
    error SSR__walletNotLocked();

    ///@dev modifier custom errors.
    error SSR__guardianFreeze();

    ///@dev recover() custom errors.
    error SSR__recover__walletNotLocked();

    ///@dev initGuardians() custom errors.
    error SSR__initGuardians__zeroGuardians();
    error SSR__initGuardians__invalidAddress();

    ///@dev addGuardian() custom errors.
    error SSR__addGuardian__invalidAddress();
    error SSR__addGuardian__contractNotLaser();

    ///@dev removeGuardian() custom errors.
    error SSR__removeGuardian__invalidAddress();
    error SSR__removeGuardian__incorrectPreviousGuardian();
    error SSR__removeGuardian__underflow();

    ///@dev access() custom error.
    error SSR__access__guardiansBlocked();

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
     * The guardians will be blocked until the owner decides otherwise.
     */
    function recoveryUnlock() external;

    /**
     * @dev Can only recover with the signature of 1 guardian and the recovery owner.
     * @param newOwner The new owner address. This is generated instantaneously.
     * @param newRecoveryOwner The new recovery owner address. This is generated instantaneously.
     * @notice The newOwner and newRecoveryOwner key pair should be generated from the mobile device.
     * The main reason of this is to restart the generation process in case an attacker has the current recoveryOwner.
     */
    function recover(address newOwner, address newRecoveryOwner) external;

    /**
     * @dev Changes the recoveryOwner address. Only the owner can call this function.
     * @param newRecoveryOwner The new recovery owner address.
     */
    function changeRecoveryOwner(address newRecoveryOwner) external;

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
    function removeGuardian(address prevGuardian, address guardianToRemove)
        external;

    /**
     * @param guardian Requested address.
     * @return Boolean if the address is a guardian of the current wallet.
     */
    function isGuardian(address guardian) external view returns (bool);

    /**
     * @return Array of guardians of this.
     */
    function getGuardians() external view returns (address[] memory);
}
