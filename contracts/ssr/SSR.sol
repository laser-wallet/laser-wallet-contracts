// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../core/Me.sol";
import "../interfaces/IEIP1271.sol";
import "../interfaces/IERC165.sol";
import "../interfaces/ISSR.sol";
import "../utils/Utils.sol";

/**
 * @title SSR - Smart Social Recovery
 * @notice Laser's recovery mechanism.
 * @author Rodrigo Herrera I.
 */
contract SSR is ISSR, Me, Utils {
    ///@dev pointer address for the nested mapping.
    address internal constant pointer = address(0x1);

    ///@dev owner should always bet at storage slot 1.
    address public owner;

    uint256 internal recoveryOwnerCount;

    uint256 internal guardianCount;

    uint256 public timeLock;

    bool public isLocked;

    // Recovery owners in a link list.
    mapping(address => address) internal recoveryOwners;

    // Guardians in a link list.
    mapping(address => address) internal guardians;

    /**
     * @dev Locks the wallet. Can only be called by a guardian.
     */
    function lock() external onlyMe {
        timeLock = block.timestamp;
        isLocked = true;
        emit WalletLocked();
    }

    /**
     * @dev Unlocks the wallet. Can only be called by a guardian + the owner.
     */
    function unlock() external onlyMe {
        timeLock = 0;
        isLocked = false;
        emit WalletUnlocked();
    }

    /**
     * @dev Unlocks the wallet. Can only be called by the owner + a recovery owner.
     * This is to avoid the wallet being locked forever if guardians misbehave.
     */
    function recoveryUnlock(
        address[] calldata prevGuardians,
        address[] calldata guardiansToRemove,
        address[] calldata newGuardians
    ) external onlyMe {
        // We first add the new guardians.
        initGuardians(newGuardians);

        uint256 arrLength = guardiansToRemove.length;
        for (uint256 i = 0; i < arrLength; ) {
            removeGuardian(prevGuardians[i], guardiansToRemove[i]);

            unchecked {
                ++i;
            }
        }

        timeLock = 0;
        isLocked = false;
        emit RecoveryUnlocked();
    }

    /**
     * @dev Can only recover with the signature of a recovery owner + a guardian.
     * @param newOwner The new owner address. This is generated instantaneously.
     */
    function recover(address newOwner) external onlyMe {
        timeLock = 0;
        isLocked = false;
        owner = newOwner;
        emit WalletRecovered(newOwner);
    }

    /**
     * @dev Adds a guardian to the wallet.
     * @param newGuardian Address of the new guardian.
     * @notice Can only be called by the owner.
     */
    function addGuardian(address newGuardian) external onlyMe {
        verifyNewRecoveryOwnerOrGuardian(newGuardian);
        guardians[newGuardian] = guardians[pointer];
        guardians[pointer] = newGuardian;

        unchecked {
            // If this overflows, this bug would be the least of the problems ..
            ++guardianCount;
        }
        emit NewGuardian(newGuardian);
    }

    /**
     * @dev Removes a guardian from the wallet.
     * @param prevGuardian Address of the previous guardian in the linked list.
     * @param guardianToRemove Address of the guardian to be removed.
     * @notice Can only be called by the owner.
     */
    function removeGuardian(address prevGuardian, address guardianToRemove) public onlyMe {
        // There needs to be at least 2 guardian ...
        if (guardianCount < 3) revert SSR__removeGuardian__underflow();

        if (guardianToRemove == pointer) revert SSR__removeGuardian__invalidAddress();

        if (guardians[prevGuardian] != guardianToRemove) revert SSR__removeGuardian__incorrectPreviousGuardian();

        guardians[prevGuardian] = guardians[guardianToRemove];
        guardians[guardianToRemove] = address(0);

        unchecked {
            // Can't underflow, there needs to be more than 2 guardians to reach here.
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
    ) external onlyMe {
        verifyNewRecoveryOwnerOrGuardian(newGuardian);
        if (guardians[prevGuardian] != oldGuardian) revert SSR__swapGuardian__invalidPrevGuardian();

        if (oldGuardian == pointer) revert SSR__swapGuardian__invalidOldGuardian();

        guardians[newGuardian] = guardians[oldGuardian];
        guardians[prevGuardian] = newGuardian;
        guardians[oldGuardian] = address(0);
        emit GuardianSwapped(newGuardian, oldGuardian);
    }

    /**
     * @dev Adds a recovery owner to the wallet.
     * @param newRecoveryOwner Address of the new recovery owner.
     * @notice Can only be called by the owner.
     */
    function addRecoveryOwner(address newRecoveryOwner) external onlyMe {
        verifyNewRecoveryOwnerOrGuardian(newRecoveryOwner);
        recoveryOwners[newRecoveryOwner] = recoveryOwners[pointer];
        recoveryOwners[pointer] = newRecoveryOwner;

        unchecked {
            // If this overflows, this bug would be the least of the problems ...
            ++recoveryOwnerCount;
        }
        emit NewRecoveryOwner(newRecoveryOwner);
    }

    /**
     * @dev Removes a recovery owner  to the wallet.
     * @param prevRecoveryOwner Address of the previous recovery owner in the linked list.
     * @param recoveryOwnerToRemove Address of the recovery owner to be removed.
     * @notice Can only be called by the owner.
     */
    function removeRecoveryOwner(address prevRecoveryOwner, address recoveryOwnerToRemove) external onlyMe {
        // There needs to be at least 1 recovery owner.
        if (recoveryOwnerCount < 2) revert SSR__removeRecoveryOwner__underflow();

        if (recoveryOwnerToRemove == pointer) revert SSR__removeRecoveryOwner__invalidAddress();

        if (recoveryOwners[prevRecoveryOwner] != recoveryOwnerToRemove) {
            revert SSR__removeRecoveryOwner__incorrectPreviousRecoveryOwner();
        }

        recoveryOwners[prevRecoveryOwner] = recoveryOwners[recoveryOwnerToRemove];
        recoveryOwners[recoveryOwnerToRemove] = address(0);

        unchecked {
            // Can't underflow, there needs to be at least 1 recovery owner.
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
    ) external onlyMe {
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
     * @return Array of the guardians of this wallet.
     */
    function getGuardians() public view returns (address[] memory) {
        address[] memory guardiansArray = new address[](guardianCount);
        address currentGuardian = guardians[pointer];

        uint256 index = 0;
        while (currentGuardian != pointer) {
            guardiansArray[index] = currentGuardian;
            currentGuardian = guardians[currentGuardian];
            unchecked {
                ++index;
            }
        }
        return guardiansArray;
    }

    /**
     * @return Array of the recovery owners of this wallet.
     */
    function getRecoveryOwners() public view returns (address[] memory) {
        address[] memory recoveryOwnersArray = new address[](recoveryOwnerCount);
        address currentRecoveryOwner = recoveryOwners[pointer];

        uint256 index;
        while (currentRecoveryOwner != pointer) {
            recoveryOwnersArray[index] = currentRecoveryOwner;
            currentRecoveryOwner = recoveryOwners[currentRecoveryOwner];
            unchecked {
                ++index;
            }
        }
        return recoveryOwnersArray;
    }

    /**
     * @dev Inits the owner. This can only be called at creation.
     * @param _owner The owner of the wallet.
     */
    function initOwner(address _owner) internal {
        // If owner is not address 0, the wallet was already initialized ...
        if (owner != address(0)) revert SSR__initOwner__walletInitialized();

        if (_owner.code.length != 0 || _owner == address(0)) revert SSR__initOwner__invalidAddress();

        assembly {
            // We store the owner at storage slot 1 through inline assembly to save some gas and to be very explicit about slot positions.
            sstore(1, _owner)
        }
    }

    /**
     * @dev Sets up the initial guardian configuration. Can only be called from the init function.
     * @param _guardians Array of guardians.
     */
    function initGuardians(address[] calldata _guardians) internal {
        uint256 guardiansLength = _guardians.length;

        if (guardiansLength < 1) revert SSR__initGuardians__underflow();

        address currentGuardian = pointer;

        for (uint256 i = 0; i < guardiansLength; ) {
            address guardian = _guardians[i];

            guardians[currentGuardian] = guardian;
            currentGuardian = guardian;

            verifyNewRecoveryOwnerOrGuardian(guardian);

            unchecked {
                ++i;
            }
        }

        guardians[currentGuardian] = pointer;
        guardianCount = guardiansLength;
    }

    /**
     * @dev Inits the recovery owners.
     * @param _recoveryOwners Array of ricovery owners.
     * @notice There needs to be at least 2 recovery owners.
     */
    function initRecoveryOwners(address[] calldata _recoveryOwners) internal {
        uint256 recoveryOwnersLength = _recoveryOwners.length;

        if (recoveryOwnersLength < 1) revert SSR__initRecoveryOwners__underflow();

        address currentRecoveryOwner = pointer;

        for (uint256 i = 0; i < recoveryOwnersLength; ) {
            address recoveryOwner = _recoveryOwners[i];

            recoveryOwners[currentRecoveryOwner] = recoveryOwner;
            currentRecoveryOwner = recoveryOwner;

            verifyNewRecoveryOwnerOrGuardian(recoveryOwner);

            unchecked {
                // If it overflows, this bug would be the least of the problems ...
                ++i;
            }
        }

        recoveryOwners[currentRecoveryOwner] = pointer;
        recoveryOwnerCount = recoveryOwnersLength;
    }

    /**
     * @dev Returns who has access to call a specific function.
     * @param funcSelector The function selector: bytes4(keccak256(...)).
     */
    function access(bytes4 funcSelector) internal view returns (Access) {
        if (funcSelector == this.lock.selector) {
            // Only a guardian can lock the wallet.

            return Access.Guardian;
        } else if (funcSelector == this.unlock.selector) {
            // Only the owner + a guardian can unlock the wallet to its current state.

            return Access.OwnerAndGuardian;
        } else if (funcSelector == this.recoveryUnlock.selector) {
            // Only the owner + a recovery owner can recoveryUnlock the wallet.

            // This is in case a guardian is misbehaving.
            return Access.OwnerAndRecoveryOwner;
        } else if (funcSelector == this.recover.selector) {
            // Only the recovery owner + a guardian can recover the wallet (change the owner key).

            // We need to make sure that the 1 week delay has passed.
            timeLockVerifier();

            return Access.RecoveryOwnerAndGuardian;
        } else {
            // Else is the owner. If the the wallet is locked, we revert.

            if (isLocked) revert SSR__access__walletLocked();
            else return Access.Owner;
        }
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

    function timeLockVerifier() internal view {
        // We make sure that 1 week has passed.
        if (timeLock + 1 weeks > block.timestamp) revert SSR__timeLockVerifier__lessThanOneWeek();

        // We make sure that timeLock was activated.
        if (timeLock == 0) revert SSR__timeLockVerifier__notActivated();
    }
}
