// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../core/SelfAuthorized.sol";
import "../core/Owner.sol";
import "../interfaces/IEIP1271.sol";
import "../interfaces/IERC165.sol";
import "../interfaces/ISSR.sol";
import "../utils/Utils.sol";

/**
 * @title SSR - Smart Social Recovery
 * @notice New wallet recovery mechanism.
 * @author Rodrigo Herrera I.
 */
contract SSR is ISSR, SelfAuthorized, Owner, Utils {
    ///@dev pointer address for the nested mapping.
    address internal constant pointer = address(0x1);

    uint256 internal recoveryOwnerCount;

    uint256 internal guardianCount;

    uint256 public timeLock;

    bool public isLocked;

    ///@dev If guardians are locked, they cannot do any transaction.
    ///This is to completely prevent from guardians misbehaving.
    bool public guardiansLocked;

    mapping(address => address) internal recoveryOwners;

    mapping(address => address) internal guardians;

    /**
     * @dev Locks the wallet. Can only be called by a guardian.
     */
    function lock() external authorized {
        timeLock = block.timestamp;
        isLocked = true;
        emit WalletLocked();
    }

    /**
     * @dev Unlocks the wallet. Can only be called by a guardian + the owner.
     */
    function unlock() external authorized {
        timeLock = 0;
        isLocked = false;
        emit WalletUnlocked();
    }

    /**
     * @dev Unlocks the wallet. Can only be called by a recovery owner + the owner.
     * This is to avoid the wallet being locked forever if a guardian misbehaves.
     * The guardians will be locked until the owner decides otherwise.
     */
    function recoveryUnlock() external authorized {
        isLocked = false;
        guardiansLocked = true;
        emit RecoveryUnlocked();
    }

    /**
     * @dev Unlocks the guardians. This can only be called by the owner.
     */
    function unlockGuardians() external authorized {
        guardiansLocked = false;
    }

    /**
     * @dev Can only recover with the signature of 1 guardian and the recovery owner.
     * @param newOwner The new owner address. This is generated instantaneously.
     */
    function recover(address newOwner) external authorized {
        timeLock = 0;
        owner = newOwner;
        emit WalletRecovered(newOwner);
    }

    /**
     * @dev Adds a guardian to the wallet.
     * @param newGuardian Address of the new guardian.
     * @notice Can only be called by the owner.
     */
    function addGuardian(address newGuardian) external authorized {
        verifyNewRecoveryOwnerOrGuardian(newGuardian);
        guardians[newGuardian] = guardians[pointer];
        guardians[pointer] = newGuardian;

        unchecked {
            // Won't overflow...
            ++guardianCount;
        }
        emit NewGuardian(newGuardian);
    }

    /**
     * @dev Removes a guardian to the wallet.
     * @param prevGuardian Address of the previous guardian in the linked list.
     * @param guardianToRemove Address of the guardian to be removed.
     * @notice Can only be called by the owner.
     */
    function removeGuardian(address prevGuardian, address guardianToRemove) external authorized {
        if (guardianToRemove == pointer) revert SSR__removeGuardian__invalidAddress();

        if (guardians[prevGuardian] != guardianToRemove) revert SSR__removeGuardian__incorrectPreviousGuardian();

        // There needs to be at least 1 guardian ..
        if (guardianCount - 1 < 1) revert SSR__removeGuardian__underflow();

        guardians[prevGuardian] = guardians[guardianToRemove];
        guardians[guardianToRemove] = address(0);
        unchecked {
            //Won't underflow...
            --guardianCount;
        }
        emit GuardianRemoved(guardianToRemove);
    }

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
    ) external authorized {
        verifyNewRecoveryOwnerOrGuardian(newGuardian);
        if (guardians[prevGuardian] != oldGuardian) revert SSR__swapGuardian__invalidPrevGuardian();

        if (oldGuardian == pointer) revert SSR__swapGuardian__invalidOldGuardian();

        guardians[newGuardian] = guardians[oldGuardian];
        guardians[prevGuardian] = newGuardian;
        guardians[oldGuardian] = address(0);
        emit GuardianSwapped(newGuardian, oldGuardian);
    }

    /**
     * @dev Adds a new recovery owner to the chain list.
     * @param newRecoveryOwner The address of the new recovery owner.
     * @notice The new recovery owner will be added at the end of the chain.
     */
    function addRecoveryOwner(address newRecoveryOwner) external authorized {
        verifyNewRecoveryOwnerOrGuardian(newRecoveryOwner);
        recoveryOwners[newRecoveryOwner] = recoveryOwners[pointer];
        unchecked {
            ++recoveryOwnerCount;
        }
        emit NewRecoveryOwner(newRecoveryOwner);
    }

    /**
     * @dev Removes a guardian to the wallet.
     * @param prevRecoveryOwner Address of the previous recovery owner in the linked list.
     * @param recoveryOwnerToRemove Address of the recovery owner to be removed.
     * @notice Can only be called by the owner.
     */
    function removeRecoveryOwner(address prevRecoveryOwner, address recoveryOwnerToRemove) external authorized {
        if (recoveryOwnerCount - 1 < 2) revert SSR__removeRecoveryOwner__incorrectIndex();

        ///@todo Add checks.
        recoveryOwners[prevRecoveryOwner] = recoveryOwners[recoveryOwnerToRemove];
        recoveryOwners[recoveryOwnerToRemove] = address(0);
        unchecked {
            --recoveryOwnerCount;
        }
        emit RecoveryOwnerRemoved(recoveryOwnerToRemove);
    }

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
    ) external authorized {
        verifyNewRecoveryOwnerOrGuardian(newRecoveryOwner);
        if (recoveryOwners[prevRecoveryOwner] != oldRecoveryOwner) {
            revert SSR__swapRecoveryOwner__invalidPrevRecoveryOwner();
        }
        if (oldRecoveryOwner == pointer) {
            revert SSR__swapRecoveryOwner__invalidOldRecoveryOwner();
        }

        recoveryOwners[newRecoveryOwner] = recoveryOwners[oldRecoveryOwner];
        recoveryOwners[prevRecoveryOwner] = newRecoveryOwner;
        recoveryOwners[oldRecoveryOwner] = address(0);
        emit RecoveryOwnerSwapped(newRecoveryOwner, oldRecoveryOwner);
    }

    /**
     * @param guardian Requested address.
     * @return Boolean if the address is a guardian of the current wallet.
     */
    function isGuardian(address guardian) external view returns (bool) {
        return guardian != pointer && guardians[guardian] != address(0);
    }

    /**
     * @return Array of the recovery owners in struct format 'RecoverySettings'.
     */
    function getRecoveryOwners() external view returns (address[] memory) {
        address[] memory recoveryOwnersArray = new address[](recoveryOwnerCount);
        address currentRecoveryOwner = recoveryOwners[pointer];

        uint256 index;
        while (currentRecoveryOwner != pointer) {
            recoveryOwnersArray[index] = currentRecoveryOwner;
            currentRecoveryOwner = recoveryOwners[currentRecoveryOwner];
            unchecked {
                //Even if it is a view function, we reduce gas costs if it is called by another contract.
                ++index;
            }
        }
        return recoveryOwnersArray;
    }

    /**
     * @return Array of guardians of this.
     */
    function getGuardians() external view returns (address[] memory) {
        address[] memory guardiansArray = new address[](guardianCount);
        address currentGuardian = guardians[pointer];

        uint256 index = 0;
        while (currentGuardian != pointer) {
            guardiansArray[index] = currentGuardian;
            currentGuardian = guardians[currentGuardian];
            unchecked {
                //Even if it is a view function, we reduce gas costs if it is called by another contract.
                ++index;
            }
        }
        return guardiansArray;
    }

    /**
     * @dev Inits the recovery owners.
     * @param _recoveryOwners Array of ricovery owners.
     * @notice There needs to be at least 2 recovery owners.
     */
    function initRecoveryOwners(address[] calldata _recoveryOwners) internal {
        uint256 recoveryOwnersLength = _recoveryOwners.length;
        // There needs to be at least 2 recovery owners.
        if (recoveryOwnersLength < 2) revert SSR__initRecoveryOwners__underflow();

        address currentRecoveryOwner = pointer;
        for (uint256 i = 0; i < recoveryOwnersLength; ) {
            address recoveryOwner = _recoveryOwners[i];
            recoveryOwners[currentRecoveryOwner] = recoveryOwner;
            currentRecoveryOwner = recoveryOwner;
            verifyNewRecoveryOwnerOrGuardian(recoveryOwner);

            unchecked {
                // Won't overflow ...
                ++i;
            }
        }

        recoveryOwners[currentRecoveryOwner] = pointer;
        recoveryOwnerCount = recoveryOwnersLength;
    }

    /**
     * @dev Sets up the initial guardian configuration. Can only be called from the init function.
     * @param _guardians Array of guardians.
     */
    function initGuardians(address[] calldata _guardians) internal {
        uint256 guardiansLength = _guardians.length;
        // There needs to be at least 2 guardians.
        if (guardiansLength < 2) revert SSR__initGuardians__underflow();

        address currentGuardian = pointer;

        for (uint256 i = 0; i < guardiansLength; ) {
            address guardian = _guardians[i];
            unchecked {
                // Won't overflow...
                ++i;
            }
            guardians[currentGuardian] = guardian;
            currentGuardian = guardian;
            verifyNewRecoveryOwnerOrGuardian(guardian);
        }

        guardians[currentGuardian] = pointer;
        guardianCount = guardiansLength;
    }

    /**
     * @dev Returns who has access to call a specific function.
     * @param funcSelector The function selector: bytes4(keccak256(...)).
     */
    function access(bytes4 funcSelector) internal view returns (Access) {
        if (funcSelector == this.lock.selector) {
            // Only a guardian can lock the wallet ...

            // If  guardians are locked, we revert ...
            if (guardiansLocked) revert SSR__access__guardiansLocked();
            else return Access.Guardian;
        } else if (funcSelector == this.unlock.selector) {
            // Only a guardian + the owner can unlock the wallet ...

            return Access.OwnerAndGuardian;
        } else if (funcSelector == this.recoveryUnlock.selector) {
            // This is in case a guardian is misbehaving ...

            return Access.OwnerAndRecoveryOwner;
        } else if (funcSelector == this.recover.selector) {
            // Only the recovery owner + the guardian can recover the wallet (change the owner keys) ...

            return Access.RecoveryOwnerAndGuardian;
        } else {
            // Else is the owner ... If the the wallet is locked, we revert ...

            if (isLocked) revert SSR__access__walletLocked();
            else return Access.Owner;
        }
    }

    /**
     * @dev Validates that a recovery owner can execute an operation 'now'.
     * @param signer The returned address from the provided signature and hash.
     */
    function validateRecoveryOwner(address signer) internal view {
        // Time elapsed since the recovery mechanism was activated.
        uint256 elapsedTime = block.timestamp - timeLock;
        address currentRecoveryOwner = recoveryOwners[pointer];
        bool isAuthorized;
        uint256 index;

        while (currentRecoveryOwner != pointer) {
            if (elapsedTime > 1 weeks * index) {
                // Each recovery owner (index ordered) has access to sign the transaction after 1 week.
                // e.g. The first recovery owner (indexed 0) can sign immediately, the second recovery owner needs to wait 1 week, the third 2 weeks, and so on ...

                if (currentRecoveryOwner == signer) isAuthorized = true;
            }
            currentRecoveryOwner = recoveryOwners[currentRecoveryOwner];

            unchecked {
                ++index;
            }
        }

        if (!isAuthorized) revert SSR__validateRecoveryOwner__notAuthorized();
    }

    /**
     * @dev Checks that the provided address is correct for a new recovery owner or guardian.
     * @param toVerify The address to verify.
     */
    function verifyNewRecoveryOwnerOrGuardian(address toVerify) internal view {
        if (toVerify.code.length > 0) {
            // If the recovery owner is a smart contract wallet, it needs to support EIP1271.
            if (!IERC165(toVerify).supportsInterface(0x1626ba7e)) {
                revert SSR__verifyNewRecoveryOwnerOrGuardian__invalidAddress();
            }
        }

        if (
            toVerify == address(0) ||
            toVerify == owner ||
            guardians[toVerify] != address(0) ||
            recoveryOwners[toVerify] != address(0)
        ) revert SSR__verifyNewRecoveryOwnerOrGuardian__invalidAddress();
    }
}
