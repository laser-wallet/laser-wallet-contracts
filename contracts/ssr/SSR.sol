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

    uint256 internal recoveryOwnersCount;

    uint256 internal guardianCount;

    uint256 internal timeLock;

    bool public isLocked;

    ///@dev If guardians are locked, they cannot do any transaction.
    ///This is to completely prevent from guardians misbehaving.
    bool public guardiansLocked;

    mapping(uint256 => RecoverySettings) internal recoveryOwners;

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
     * @dev Unlocks the wallet. Can only be called by the recovery owner + the owner.
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
     * @param newRecoveryOwner The new recovery owner address. This is generated instantaneously.
     * @notice The newOwner and newRecoveryOwner key pair should be generated from the mobile device.
     * The main reason of this is to restart the generation process in case an attacker has the current recoveryOwner.
     */
    function recover(address newOwner, address newRecoveryOwner)
        external
        authorized
    {
        timeLock = 0;
        owner = newOwner;
        // recoveryOwner = newRecoveryOwner;
        emit WalletRecovered(newOwner, newRecoveryOwner);
    }

    /**
     * @dev Adds a guardian to the wallet.
     * @param newGuardian Address of the new guardian.
     * @notice Can only be called by the owner.
     */
    function addGuardian(address newGuardian) external authorized {
        if (
            newGuardian == address(0) ||
            newGuardian == owner ||
            guardians[newGuardian] != address(0)
        ) revert SSR__addGuardian__invalidAddress();

        if (!IERC165(newGuardian).supportsInterface(0x1626ba7e)) {
            revert SSR__addGuardian__invalidAddress();
        }

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
    function removeGuardian(address prevGuardian, address guardianToRemove)
        external
        authorized
    {
        if (guardianToRemove == pointer) {
            revert SSR__removeGuardian__invalidAddress();
        }

        if (guardians[prevGuardian] != guardianToRemove) {
            revert SSR__removeGuardian__incorrectPreviousGuardian();
        }

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
     * @dev Adds a new recovery owner to the chain list.
     * @param newRecoveryOwner The address of the new recovery owner.
     * @notice The new recovery owner will be added at the end of the chain.
     */
    function addRecoveryOwner(address newRecoveryOwner) external authorized {
        if (newRecoveryOwner.code.length > 0) {
            // If the recovery owner is a smart contract wallet, it needs to support EIP1271.
            if (!IERC165(newRecoveryOwner).supportsInterface(0x1626ba7e)) {
                revert SSR__initRecoveryOwners__invalidAddress();
            }
        }

        if (
            newRecoveryOwner == address(0) ||
            newRecoveryOwner == owner ||
            guardians[newRecoveryOwner] != address(0)
        ) revert SSR__addRecoveryOwner__invalidAddress();

        uint256 _recoveryOwnersCount = recoveryOwnersCount;

        recoveryOwners[_recoveryOwnersCount] = RecoverySettings({
            recoveryOwner: newRecoveryOwner,
            ownerIndex: _recoveryOwnersCount,
            time: _recoveryOwnersCount * 1 weeks
        });

        emit NewRecoveryOwner(newRecoveryOwner);
    }

    /**
     * @dev Removes a recovery owner.
     * @param recoveryOwner The address to be removed as recovery owner.
     * @param index The position of the recovery owner in the chain list.
     * @notice The recovery owners that are positioned after the deleted recovery owner will be forward 1 position in the chain list.
     */
    function removeRecoveryOwner(address recoveryOwner, uint256 index)
        external
        authorized
    {
        uint256 _recoveryOwnersCount = recoveryOwnersCount;

        if (_recoveryOwnersCount - 1 > index) {
            revert SSR__removeRecoveryOwner__incorrectIndex();
        }
    }

    /**
     * @dev Swaps a recovery owner for a new address.
     * @param newRecoveryOwner The address of the new recovery owner.
     * @param oldRecoveryOwner The address of the current recovery owner to be swapped by the new one.
     */
    function swapRecoveryOwner(
        address newRecoveryOwner,
        address oldRecoveryOwner
    ) external authorized {}

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
    function getRecoveryOwners()
        external
        view
        returns (RecoverySettings[] memory)
    {
        RecoverySettings[] memory recoveryOwnersArray = new RecoverySettings[](
            recoveryOwnersCount
        );

        for (uint256 i = 0; i < recoveryOwnersCount; i++) {
            recoveryOwnersArray[i] = recoveryOwners[i];
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
            index++;
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
        if (recoveryOwnersLength < 2) {
            revert SSR__initRecoveryOwners__underflow();
        }

        for (uint256 i = 0; i < recoveryOwnersLength; ) {
            address recoveryOwner = _recoveryOwners[i];

            if (recoveryOwner.code.length > 0) {
                // If the recovery owner is a smart contract wallet, it needs to support EIP1271.
                if (!IERC165(recoveryOwner).supportsInterface(0x1626ba7e)) {
                    revert SSR__initRecoveryOwners__invalidAddress();
                }
            }

            if (
                recoveryOwner == address(0) ||
                recoveryOwner == owner ||
                guardians[recoveryOwner] != address(0)
            ) revert SSR__initRecoveryOwners__invalidAddress();

            recoveryOwners[i] = RecoverySettings({
                recoveryOwner: recoveryOwner,
                ownerIndex: i,
                time: i * 1 weeks
            });
            unchecked {
                ++i;
            }
        }
        recoveryOwnersCount = recoveryOwnersLength;
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
            if (
                guardian == owner ||
                guardian == address(0) ||
                guardian == pointer ||
                guardian == currentGuardian ||
                guardians[guardian] != address(0)
            ) revert SSR__initGuardians__invalidAddress();

            if (guardian.code.length > 0) {
                // If the guardian is a smart contract wallet, it needs to support EIP1271.
                if (!IERC165(guardian).supportsInterface(0x1626ba7e)) {
                    revert SSR__initGuardians__invalidAddress();
                }
            }

            unchecked {
                // Won't overflow...
                ++i;
            }
            guardians[currentGuardian] = guardian;
            currentGuardian = guardian;
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
            if (guardiansLocked) revert SSR__access__guardiansBlocked();
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

        bool isAuthorized;

        for (uint256 i = 0; i < recoveryOwnersCount; ) {
            address recoveryOwner = recoveryOwners[i].recoveryOwner;

            if (elapsedTime > 1 weeks * i) {
                // Each recovery owner (index ordered) has access to sign the transaction after 1 week.
                // e.g The first recovery owner (indexed 0) can sign immediately, the second recovery owner needs to wait 1 week, and so on ...

                if (recoveryOwner == signer) isAuthorized = true;
            }

            unchecked {
                ++i;
            }
        }

        if (!isAuthorized) revert SSR__validateRecoveryOwner__notAuthorized();
    }
}
