/**
 * @title ISSR
 * @notice Has all the external functions, structs, events and errors for SSR.sol.
 */
interface ISSR {
    ///@dev Determines who has access to call a specific function.
    enum Access {
        Owner,
        Guardian,
        RecoveryOwnerAndGuardian
    }

    event WalletLocked();
    event WalletUnlocked();
    event NewGuardian(address newGuardian);
    event GuardianRemoved(address removedGuardian);
    event SuccesfullRecovery(address owner, address recoveryOwner);
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

    /**
     * @dev Locks the wallet. Can only be called by a guardian.
     */
    function lock() external;

    /**
     * @dev Unlocks the wallet. Can only be called by a guardian + the owner.
     */
    function unlock() external;

    /**
     * @dev Can only recover with the signature of 1 guardian and the recovery owner.
     * @param newOwner The new owner address. This is generated instantaneously.
     * @param newRecoveryOwner The new recovery owner address. This is generated instantaneously.
     * @notice The newOwner and newRecoveryOwner key pair should be generated from the mobile device.
     * The main reason of this is to restart the generation process in case an attacker has the current recoveryOwner.
     */
    function recover(address newOwner, address newRecoveryOwner) external;
}
